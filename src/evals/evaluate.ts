import {observedBlockNames} from './blockNames.ts';
import {evaluateDeterministicAssertions} from './deterministicAssertions.ts';
import {traceAccounting} from './reportAccounting.ts';
import type {EvaluationScenario} from './scenario.ts';
import type {
    CheckResult,
    DataAssertionEvaluator,
    DataAssertionResult,
    EvaluationResult,
    EvaluationStatus,
    EvaluationTrace
} from './types.ts';

export {blockNameFor, observedBlockNames} from './blockNames.ts';

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const coverageCheck = (name: string, expected: string[], observed: string[]): CheckResult =>
{
    const missing = expected.filter((item) => !observed.includes(item));
    return {
        name,
        status: missing.length === 0 ? 'passed' : 'failed',
        expected,
        observed,
        ...missing.length > 0 && {detail: `Missing: ${missing.join(', ')}`}
    };
};

const forbiddenToolCheck = (forbidden: string[], observed: string[]): CheckResult =>
{
    const invoked = forbidden.filter((tool) => observed.includes(tool));
    return {
        name: 'forbidden_tools',
        status: invoked.length === 0 ? 'passed' : 'failed',
        expected: forbidden,
        observed,
        ...invoked.length > 0 && {detail: `Invoked forbidden tools: ${invoked.join(', ')}`}
    };
};

const unevaluatedAssertions = (scenario: EvaluationScenario): DataAssertionResult[] =>
    scenario.dataAssertions.map((assertion) => ({
        assertion,
        status: 'not_evaluated',
        detail: 'No data assertion evaluator was configured'
    }));


const resultStatus = (
    trace: EvaluationTrace,
    checks: CheckResult[],
    assertions: DataAssertionResult[]
): EvaluationStatus =>
{
    if (trace.error)
    {
        return 'error';
    }
    if (checks.some(({status}) => status === 'failed') || assertions.some(({status}) => status === 'failed'))
    {
        return 'failed';
    }
    if (assertions.some(({status}) => status === 'not_evaluated'))
    {
        return 'incomplete';
    }
    return 'passed';
};

export const evaluateTrace = async (
    scenario: EvaluationScenario,
    trace: EvaluationTrace,
    dataAssertionEvaluator?: DataAssertionEvaluator
): Promise<EvaluationResult> =>
{
    if (trace.scenarioId !== scenario.id)
    {
        throw new Error(`Trace scenario ${trace.scenarioId} does not match ${scenario.id}`);
    }

    const eventTools = [trace, ...trace.trajectory ?? []].flatMap((turn) => turn.events.flatMap(({event}) =>
        event.type === 'tool.started' || event.type === 'tool.completed' ? [event.name] : []));
    const tools = unique([...eventTools, ...trace.toolCalls, ...(trace.toolExecutions ?? []).map(({name}) => name),
        ...(trace.trajectory ?? []).flatMap((turn) => [...turn.toolCalls, ...(turn.toolExecutions ?? []).map(({name}) => name)])]);
    const blocks = observedBlockNames(trace);
    const checks = [
        coverageCheck('expected_tools', scenario.expectedTools, tools),
        coverageCheck('expected_blocks', scenario.expectedBlocks, blocks),
        forbiddenToolCheck(scenario.mustNotInvoke, tools)
    ];
    if (trace.fixture) checks.push({name: 'fixture_integrity',
        status: trace.fixture.unexpectedMutation ? 'failed' : 'passed'});
    if (trace.traceVersion === 2) checks.push({name: 'terminal_outcome',
        status: trace.outcome === 'completed' ? 'passed' : 'failed', detail: trace.outcome});
    if (trace.traceVersion === 2) checks.push({name: 'tool_receipts', status: trace.toolCalls.every((name) =>
        (trace.toolExecutions ?? []).filter((tool) => tool.name === name).length
            >= trace.toolCalls.filter((tool) => tool === name).length) ? 'passed' : 'failed'});
    const dataAssertions = dataAssertionEvaluator
        ? await dataAssertionEvaluator(scenario, trace)
        : scenario.deterministicAssertions?.length
            ? evaluateDeterministicAssertions(scenario, trace)
            : unevaluatedAssertions(scenario);

    if (dataAssertions.length !== scenario.dataAssertions.length
        || dataAssertions.some((result, index) => result.assertion !== scenario.dataAssertions[index]))
    {
        throw new Error(`Data assertion evaluator returned mismatched results for ${scenario.id}`);
    }

    return {
        accounting: traceAccounting(trace),
        grading: dataAssertionEvaluator ? 'external_unverified' : 'deterministic',
        scenarioId: scenario.id,
        category: scenario.category,
        runId: trace.runId,
        status: resultStatus(trace, checks, dataAssertions),
        expectations: {
            expectedTools: [...scenario.expectedTools],
            expectedBlocks: [...scenario.expectedBlocks],
            forbiddenTools: [...scenario.mustNotInvoke],
            dataAssertions: [...scenario.dataAssertions]
        },
        observed: {tools, blocks},
        checks,
        dataAssertions,
        latency: trace.latency,
        ...trace.usage && {usage: trace.usage},
        ...trace.cost && {cost: trace.cost},
        ...trace.error && {error: trace.error},
        trace
    };
};
