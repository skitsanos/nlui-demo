import {datasetQueryHasWhereEquality} from '../data/queryPolicy.ts';
import type {NluiBlock} from '../nlui/types.ts';
import type {DeterministicAssertion, EvaluationBlockName, EvaluationScenario} from './scenario.ts';
import type {
    CheckResult,
    DataAssertionEvaluator,
    DataAssertionResult,
    EvaluationResult,
    EvaluationStatus,
    EvaluationTrace
} from './types.ts';

const unique = <T>(values: T[]): T[] => [...new Set(values)];

export const blockNameFor = (block: NluiBlock): EvaluationBlockName =>
{
    switch (block.type)
    {
        case 'stats':
            return 'metrics';
        case 'choices':
            return 'choice';
        case 'sources':
            return 'citations';
        case 'result':
            return block.status === 'error' ? 'error' : 'action_result';
        default:
            return block.type;
    }
};

export const observedBlockNames = (trace: EvaluationTrace): EvaluationBlockName[] =>
{
    const blocks = trace.blocks.map(blockNameFor);
    if (trace.text.trim().length > 0)
    {
        blocks.push('markdown');
    }
    return unique(blocks);
};

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

const valueAtPath = (source: unknown, path: string): unknown =>
{
    let current = source;
    for (const part of path.split('.'))
    {
        if (typeof current !== 'object' || current === null || !Object.hasOwn(current, part))
        {
            return undefined;
        }
        current = (current as Record<string, unknown>)[part];
    }
    return current;
};

const toolAssertionPassed = (assertion: Extract<DeterministicAssertion, {source: 'tool'}>, observed: unknown): boolean =>
{
    if (assertion.operator === 'equals') return observed === assertion.expected;
    if (assertion.operator === 'length_equals')
    {
        return (Array.isArray(observed) || typeof observed === 'string')
            && observed.length === assertion.expected;
    }
    if (assertion.operator === 'contains_value')
    {
        return (Array.isArray(observed) && observed.includes(assertion.expected))
            || (typeof observed === 'object' && observed !== null
                && Object.values(observed).includes(assertion.expected));
    }
    return (Array.isArray(observed) && observed.includes(assertion.expected))
        || (typeof observed === 'string' && typeof assertion.expected === 'string'
            && observed.includes(assertion.expected));
};

const exactNumberInText = (text: string, expected: number): boolean =>
{
    const escaped = String(expected).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\d.,])${escaped}(?![\\d.,])`).test(text);
};

const evaluateRule = (rule: DeterministicAssertion, trace: EvaluationTrace): string | undefined =>
{
    if (rule.source === 'assistant_text')
    {
        const includesExpected = typeof rule.expected === 'string'
            && trace.text.toLowerCase().includes(rule.expected.toLowerCase());
        const passed = rule.operator === 'contains_ci' ? includesExpected
            : rule.operator === 'not_contains_ci' ? !includesExpected
                : typeof rule.expected === 'number' && exactNumberInText(trace.text, rule.expected);
        return passed ? undefined : `Assistant text did not satisfy ${rule.operator} ${JSON.stringify(rule.expected)}`;
    }
    if (rule.source === 'ui')
    {
        const observed = observedBlockNames(trace).toSorted();
        const expected = rule.expected.toSorted();
        const passed = observed.length === expected.length
            && observed.every((block, index) => block === expected[index]);
        return passed
            ? undefined
            : `Expected UI block types ${JSON.stringify(expected)}, observed ${JSON.stringify(observed)}`;
    }
    const execution = trace.toolExecutions?.findLast(({name, rejected}) => name === rule.tool && !rejected);
    if (!execution) return `No ${rule.tool} execution was captured`;
    if (rule.source === 'tool_arguments')
    {
        const sql = valueAtPath(execution.arguments, 'sql');
        const passed = typeof sql === 'string'
            && datasetQueryHasWhereEquality(sql, rule.expected.column, rule.expected.value);
        return passed
            ? undefined
            : `Expected SQL WHERE ${rule.expected.column} = ${JSON.stringify(rule.expected.value)}`;
    }
    const observed = valueAtPath(execution.modelOutput, rule.path);
    return toolAssertionPassed(rule, observed)
        ? undefined
        : `Expected ${rule.path} ${rule.operator} ${JSON.stringify(rule.expected)}`;
};

const evaluateDeterministicAssertions = (
    scenario: EvaluationScenario,
    trace: EvaluationTrace
): DataAssertionResult[] =>
{
    const configured = new Map<string, DeterministicAssertion[]>();
    for (const rule of scenario.deterministicAssertions ?? [])
    {
        configured.set(rule.label, [...configured.get(rule.label) ?? [], rule]);
    }
    return scenario.dataAssertions.map((assertion) =>
    {
        const rules = configured.get(assertion);
        if (!rules)
        {
            return {assertion, status: 'not_evaluated', detail: 'No deterministic assertion is configured'};
        }
        const failures = rules.map((rule) => evaluateRule(rule, trace)).filter((detail) => detail !== undefined);
        return {
            assertion,
            status: failures.length === 0 ? 'passed' : 'failed',
            ...failures.length > 0 && {detail: failures.join('; ')}
        };
    });
};

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

    const tools = unique(trace.toolCalls);
    const blocks = observedBlockNames(trace);
    const checks = [
        coverageCheck('expected_tools', scenario.expectedTools, tools),
        coverageCheck('expected_blocks', scenario.expectedBlocks, blocks),
        forbiddenToolCheck(scenario.mustNotInvoke, tools)
    ];
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
