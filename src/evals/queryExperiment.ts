import {
    type ArmExperimentStatistics,
    type ArmRunObservation,
    summarizeArmRuns
} from './queryExperimentStatistics.ts';
import {MAX_LIVE_SCENARIOS, MAX_REPEAT_COUNT} from './run.ts';
import {
    type DeterministicAssertion,
    type EvaluationScenario,
    type EvaluationToolName,
    evaluationScenarioSchema,
    executionFor
} from './scenario.ts';
import type {EvaluationReport, EvaluationResult} from './types.ts';

export type {
    ArmExperimentStatistics,
    ArmRunObservation,
    NumericStatistic,
    RateStatistic,
    RunToRunStatistics
} from './queryExperimentStatistics.ts';

export const QUERY_EXPERIMENT_ARMS = ['control', 'semantic'] as const;
export type QueryExperimentArm = typeof QUERY_EXPERIMENT_ARMS[number];
export const MAX_PROJECTED_BILLABLE_RUNS = MAX_LIVE_SCENARIOS * MAX_REPEAT_COUNT * QUERY_EXPERIMENT_ARMS.length;

const ARM_TOOL = {control: 'query_dataset', semantic: 'semantic_query'} as const;
const OTHER_ARM_TOOL = {control: 'semantic_query', semantic: 'query_dataset'} as const;
const QUERY_TOOLS = new Set<EvaluationToolName>(Object.values(ARM_TOOL));

const isQueryTool = (tool: EvaluationToolName): boolean => QUERY_TOOLS.has(tool);

const adaptAssertion = (assertion: DeterministicAssertion, arm: QueryExperimentArm): DeterministicAssertion =>
{
    if (arm === 'semantic' && (assertion.source === 'sql_semantics' || assertion.source === 'tool_arguments'))
    {
        throw new Error(`Semantic experiment fixtures cannot use SQL-specific assertion ${assertion.source}`);
    }
    if ((assertion.source === 'tool' || assertion.source === 'denotation' || assertion.source === 'tool_sequence')
        && isQueryTool(assertion.tool))
    {
        return {...assertion, tool: ARM_TOOL[arm]};
    }
    return assertion;
};

const adaptedTools = (
    tools: EvaluationToolName[],
    replacement: EvaluationToolName,
    field: string
): EvaluationToolName[] =>
{
    const armTools = tools.filter(isQueryTool);
    if (armTools.length > 1)
    {
        throw new Error(`${field} must not contain both query experiment tools`);
    }
    return tools.map((tool) => isQueryTool(tool) ? replacement : tool);
};

export const adaptScenarioForArm = (
    scenario: EvaluationScenario,
    arm: QueryExperimentArm
): EvaluationScenario => evaluationScenarioSchema.parse({
    ...scenario,
    expectedTools: adaptedTools(scenario.expectedTools, ARM_TOOL[arm], 'expectedTools'),
    mustNotInvoke: adaptedTools(scenario.mustNotInvoke, OTHER_ARM_TOOL[arm], 'mustNotInvoke'),
    ...scenario.deterministicAssertions && {
        deterministicAssertions: scenario.deterministicAssertions.map((assertion) => adaptAssertion(assertion, arm))
    }
});

interface ExperimentFixture
{
    experimentId: string;
    byScenarioId: Map<string, EvaluationScenario>;
    cases: Set<string>;
}

const inspectFixtures = (scenarios: EvaluationScenario[]): ExperimentFixture =>
{
    if (scenarios.length < 1 || scenarios.length > MAX_LIVE_SCENARIOS)
    {
        throw new Error(`Query experiments require between 1 and ${MAX_LIVE_SCENARIOS} scenarios`);
    }
    const byScenarioId = new Map<string, EvaluationScenario>();
    const tuples = new Set<string>();
    const cases = new Set<string>();
    let experimentId = '';
    for (const scenario of scenarios)
    {
        if (!scenario.experiment) throw new Error(`Scenario ${scenario.id} is missing experiment metadata`);
        experimentId ||= scenario.experiment.id;
        if (scenario.experiment.id !== experimentId)
        {
            throw new Error('Query experiment scenarios must share one experiment id');
        }
        if (byScenarioId.has(scenario.id)) throw new Error(`Duplicate experiment scenario ${scenario.id}`);
        if (executionFor(scenario).mode !== 'single-turn')
        {
            throw new Error(`Scenario ${scenario.id} must use single-turn execution for a bounded query experiment`);
        }
        const queryTools = scenario.expectedTools.filter(isQueryTool);
        if (queryTools.length !== 1)
        {
            throw new Error(`Scenario ${scenario.id} must expect exactly one query experiment tool`);
        }
        const tuple = `${scenario.experiment.caseId}:${scenario.experiment.paraphraseId}`;
        if (tuples.has(tuple)) throw new Error(`Duplicate experiment case/paraphrase ${tuple}`);
        tuples.add(tuple);
        cases.add(scenario.experiment.caseId);
        byScenarioId.set(scenario.id, scenario);
    }
    return {experimentId, byScenarioId, cases};
};

export interface BillableRunProjection
{
    experimentId: string;
    cases: number;
    paraphrases: number;
    repeat: number;
    runsPerArm: number;
    totalRuns: number;
    maximumRuns: number;
}

export const projectBillableRuns = (scenarios: EvaluationScenario[], repeat: number): BillableRunProjection =>
{
    if (!Number.isInteger(repeat) || repeat < 1 || repeat > MAX_REPEAT_COUNT)
    {
        throw new Error(`Repeat count must be between 1 and ${MAX_REPEAT_COUNT}`);
    }
    const fixture = inspectFixtures(scenarios);
    const runsPerArm = scenarios.length * repeat;
    const totalRuns = runsPerArm * QUERY_EXPERIMENT_ARMS.length;
    if (totalRuns > MAX_PROJECTED_BILLABLE_RUNS)
    {
        throw new Error(`Projected billable runs exceed ${MAX_PROJECTED_BILLABLE_RUNS}`);
    }
    return {
        experimentId: fixture.experimentId,
        cases: fixture.cases.size,
        paraphrases: scenarios.length,
        repeat,
        runsPerArm,
        totalRuns,
        maximumRuns: MAX_PROJECTED_BILLABLE_RUNS
    };
};

export interface PairedExperimentRun
{
    key: string;
    scenarioId: string;
    iteration: number;
    caseId: string;
    paraphraseId: string;
    control: ArmRunObservation;
    semantic: ArmRunObservation;
}

export interface CaseExperimentComparison
{
    caseId: string;
    paraphraseIds: string[];
    allParaphrasesPass: {control: boolean; semantic: boolean; paired: boolean};
    allParaphrasesDenotationPass: {control: boolean; semantic: boolean; paired: boolean};
}

export interface QueryExperimentComparison
{
    experimentId: string;
    repeat: number;
    pairs: PairedExperimentRun[];
    arms: Record<QueryExperimentArm, ArmExperimentStatistics>;
    cases: CaseExperimentComparison[];
}

const sameSet = (left: string[], right: string[]): boolean =>
{
    const sortedLeft = [...new Set(left)].toSorted();
    const sortedRight = [...new Set(right)].toSorted();
    return sortedLeft.length === left.length && sortedRight.length === right.length
        && sortedLeft.length === sortedRight.length
        && sortedLeft.every((value, index) => value === sortedRight[index]);
};

const iterationFor = (result: EvaluationResult, repeat: number): number =>
{
    const parts = result.runId.split(':');
    const iteration = parts[0] === result.scenarioId && parts.length >= 3 ? Number(parts[1]) : Number.NaN;
    if (!Number.isInteger(iteration) || iteration < 1 || iteration > repeat)
    {
        throw new Error(`Result ${result.runId} does not contain a valid scenario iteration`);
    }
    return iteration;
};

const validatedResults = (
    report: EvaluationReport,
    scenarios: Map<string, EvaluationScenario>,
    arm: QueryExperimentArm,
    repeat: number
): Map<string, EvaluationResult> =>
{
    const expectedIds = [...scenarios.keys()];
    if (report.selection.repeat !== repeat || !sameSet(report.selection.scenarioIds, expectedIds))
    {
        throw new Error(`${arm} report selection does not match the experiment fixture`);
    }
    if (report.results.length !== expectedIds.length * repeat)
    {
        throw new Error(`${arm} report has ${report.results.length} results; expected ${expectedIds.length * repeat}`);
    }
    const results = new Map<string, EvaluationResult>();
    for (const result of report.results)
    {
        const scenario = scenarios.get(result.scenarioId);
        if (!scenario) throw new Error(`${arm} report contains unknown scenario ${result.scenarioId}`);
        const adapted = adaptScenarioForArm(scenario, arm);
        if (!sameSet(result.expectations.expectedTools, adapted.expectedTools)
            || !sameSet(result.expectations.forbiddenTools, adapted.mustNotInvoke)
            || !sameSet(result.expectations.expectedBlocks, adapted.expectedBlocks)
            || JSON.stringify(result.expectations.dataAssertions) !== JSON.stringify(adapted.dataAssertions))
        {
            throw new Error(`${arm} result ${result.scenarioId} is aligned to the wrong arm or fixture`);
        }
        const iteration = iterationFor(result, repeat);
        if (result.category !== adapted.category
            || result.trace.scenarioId !== result.scenarioId
            || result.trace.runId !== result.runId
            || result.dataAssertions.length !== adapted.dataAssertions.length
            || result.dataAssertions.some(({assertion}, index) => assertion !== adapted.dataAssertions[index]))
        {
            throw new Error(`${arm} result ${result.scenarioId} has misaligned result or trace metadata`);
        }
        const key = `${result.scenarioId}:${iteration}`;
        if (results.has(key)) throw new Error(`${arm} report contains duplicate pair key ${key}`);
        results.set(key, result);
    }
    return results;
};

const observationFor = (
    result: EvaluationResult,
    scenario: EvaluationScenario,
    arm: QueryExperimentArm
): ArmRunObservation =>
{
    const assertions = scenario.deterministicAssertions ?? [];
    const labelsFor = (source?: DeterministicAssertion['source']): Set<string> => new Set(
        assertions.filter((assertion) => source === undefined || assertion.source === source).map(({label}) => label)
    );
    const deterministicLabels = labelsFor();
    const passedFor = (labels: Set<string>): boolean | undefined =>
    {
        if (labels.size === 0) return undefined;
        const results = result.dataAssertions.filter(({assertion}) => labels.has(assertion));
        return results.length === labels.size && results.every(({status}) => status === 'passed');
    };
    const rejectedAttempts = result.trace.toolExecutions?.filter(({name, cached, rejected}) =>
        name === ARM_TOOL[arm] && !cached && rejected
    ).length ?? 0;
    return {
        passed: result.status === 'passed',
        exactTool: sameSet(result.observed.tools, result.expectations.expectedTools),
        deterministic: passedFor(deterministicLabels),
        denotation: passedFor(labelsFor('denotation')),
        firstAttempt: passedFor(labelsFor('tool_sequence')),
        sqlSemantics: passedFor(labelsFor('sql_semantics')),
        ui: sameSet(result.observed.blocks, result.expectations.expectedBlocks),
        latencyMs: result.latency.totalMs,
        ...result.usage?.totalTokens !== undefined && {tokens: result.usage.totalTokens},
        rounds: result.trace.providerRounds?.length ?? result.trace.responseIds.length,
        rejectedAttempts
    };
};

export const compareQueryExperiment = (
    scenarios: EvaluationScenario[],
    controlReport: EvaluationReport,
    semanticReport: EvaluationReport
): QueryExperimentComparison =>
{
    const fixture = inspectFixtures(scenarios);
    if (controlReport.dataset.id !== semanticReport.dataset.id
        || controlReport.dataset.version !== semanticReport.dataset.version)
    {
        throw new Error('Query experiment reports use different dataset versions');
    }
    const repeat = controlReport.selection.repeat;
    projectBillableRuns(scenarios, repeat);
    const control = validatedResults(controlReport, fixture.byScenarioId, 'control', repeat);
    const semantic = validatedResults(semanticReport, fixture.byScenarioId, 'semantic', repeat);
    const pairs: PairedExperimentRun[] = [];
    for (const [key, controlResult] of control)
    {
        const semanticResult = semantic.get(key);
        if (!semanticResult) throw new Error(`Semantic report is missing pair ${key}`);
        const scenario = fixture.byScenarioId.get(controlResult.scenarioId)!;
        pairs.push({
            key,
            scenarioId: scenario.id,
            iteration: iterationFor(controlResult, repeat),
            caseId: scenario.experiment!.caseId,
            paraphraseId: scenario.experiment!.paraphraseId,
            control: observationFor(controlResult, scenario, 'control'),
            semantic: observationFor(semanticResult, scenario, 'semantic')
        });
    }
    if (semantic.size !== pairs.length) throw new Error('Semantic report contains unpaired results');
    pairs.sort((left, right) => left.key.localeCompare(right.key));
    const cases = [...fixture.cases].toSorted().map((caseId): CaseExperimentComparison =>
    {
        const casePairs = pairs.filter((pair) => pair.caseId === caseId);
        const controlPass = casePairs.every(({control: run}) => run.passed);
        const semanticPass = casePairs.every(({semantic: run}) => run.passed);
        const controlDenotation = casePairs.every(({control: run}) => run.denotation === true);
        const semanticDenotation = casePairs.every(({semantic: run}) => run.denotation === true);
        return {
            caseId,
            paraphraseIds: [...new Set(casePairs.map(({paraphraseId}) => paraphraseId))].toSorted(),
            allParaphrasesPass: {control: controlPass, semantic: semanticPass, paired: controlPass && semanticPass},
            allParaphrasesDenotationPass: {
                control: controlDenotation,
                semantic: semanticDenotation,
                paired: controlDenotation && semanticDenotation
            }
        };
    });
    return {
        experimentId: fixture.experimentId,
        repeat,
        pairs,
        arms: {
            control: summarizeArmRuns(pairs.map(({scenarioId, control: observation}) => ({scenarioId, observation}))),
            semantic: summarizeArmRuns(pairs.map(({scenarioId, semantic: observation}) => ({scenarioId, observation})))
        },
        cases
    };
};
