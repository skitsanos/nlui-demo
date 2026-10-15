import {DATASET_ID, DATASET_VERSION} from '../data/constants.ts';
import {traceFailureOutcome} from '../services/traceAccounting.ts';
import {abortable} from '../utils/abort.ts';
import {estimateEvaluationCost} from './cost.ts';
import {evaluateTrace} from './evaluate.ts';
import {evaluationVersions, repeatStability, traceAccounting} from './reportAccounting.ts';
import type {EvaluationCategory, EvaluationScenario} from './scenario.ts';
import type {
    CostEstimate,
    DataAssertionEvaluator,
    EvaluationReport,
    EvaluationReportSummary,
    EvaluationResult,
    EvaluationTrace,
    ScenarioExecutor,
    TokenUsage,
    UsageResolver
} from './types.ts';

export const MAX_LIVE_SCENARIOS = 10;
export const MAX_REPEAT_COUNT = 3;

export interface ScenarioSelection
{
    ids?: string[];
    categories?: EvaluationCategory[];
    limit?: number;
}

export interface EvaluationRunOptions
{
    scenarios: EvaluationScenario[];
    executor: ScenarioExecutor;
    repeat?: number;
    timeoutMs?: number;
    dataAssertionEvaluator?: DataAssertionEvaluator;
    usageResolver?: UsageResolver;
}

export const evaluationExitCode = (
    summary: Pick<EvaluationReportSummary, 'failed' | 'incomplete' | 'errors'>,
    allowIncomplete = false,
    integrityViolation = false
): 0 | 1 | 2 =>
{
    if (integrityViolation || summary.failed > 0 || summary.errors > 0) return 1;
    if (summary.incomplete > 0 && !allowIncomplete) return 2;
    return 0;
};

export const selectScenarios = (
    scenarios: EvaluationScenario[],
    selection: ScenarioSelection
): EvaluationScenario[] =>
{
    const ids = new Set(selection.ids ?? []);
    const categories = new Set(selection.categories ?? []);
    if (ids.size === 0 && categories.size === 0)
    {
        throw new Error('Live evaluation requires an explicit scenario id or category');
    }

    const unknownIds = [...ids].filter((id) => !scenarios.some((scenario) => scenario.id === id));
    if (unknownIds.length > 0)
    {
        throw new Error(`Unknown scenario identifiers: ${unknownIds.join(', ')}`);
    }

    const limit = selection.limit ?? MAX_LIVE_SCENARIOS;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIVE_SCENARIOS)
    {
        throw new Error(`Scenario limit must be between 1 and ${MAX_LIVE_SCENARIOS}`);
    }

    return scenarios.filter((scenario) =>
        (ids.size === 0 || ids.has(scenario.id)) &&
        (categories.size === 0 || categories.has(scenario.category))
    ).slice(0, limit);
};

const failedTrace = (scenario: EvaluationScenario, runId: string, startedAt: string, error: unknown): EvaluationTrace =>
{
    const completedAt = new Date().toISOString();
    return {
        scenarioId: scenario.id,
        runId,
        startedAt,
        completedAt,
        events: [],
        text: '',
        toolCalls: [],
        blocks: [],
        responseIds: [],
        latency: {totalMs: Math.max(0, Date.parse(completedAt) - Date.parse(startedAt))},
        error: error instanceof Error ? error.message : 'Scenario execution failed'
    };
};

const addUsage = (target: TokenUsage, usage: TokenUsage): void =>
{
    if (usage.inputTokens !== undefined)
    {
        target.inputTokens = (target.inputTokens ?? 0) + usage.inputTokens;
    }
    if (usage.cachedInputTokens !== undefined)
    {
        target.cachedInputTokens = (target.cachedInputTokens ?? 0) + usage.cachedInputTokens;
    }
    if (usage.cacheWriteTokens !== undefined)
    {
        target.cacheWriteTokens = (target.cacheWriteTokens ?? 0) + usage.cacheWriteTokens;
    }
    if (usage.outputTokens !== undefined)
    {
        target.outputTokens = (target.outputTokens ?? 0) + usage.outputTokens;
    }
    if (usage.reasoningTokens !== undefined)
    {
        target.reasoningTokens = (target.reasoningTokens ?? 0) + usage.reasoningTokens;
    }
    if (usage.totalTokens !== undefined)
    {
        target.totalTokens = (target.totalTokens ?? 0) + usage.totalTokens;
    }
};

const summarize = (results: EvaluationResult[]): EvaluationReportSummary =>
{
    const totalLatencyMs = results.reduce((sum, result) => sum + result.latency.totalMs, 0);
    const usage: TokenUsage = {};
    let hasUsage = false;
    let costAmount = 0;
    let hasCost = false;
    let costSource: CostEstimate['source'] = 'provider';

    for (const result of results)
    {
        if (result.usage)
        {
            hasUsage = true;
            addUsage(usage, result.usage);
        }
        if (result.cost)
        {
            hasCost = true;
            costAmount += result.cost.amount;
            if (result.cost.source === 'estimated')
            {
                costSource = 'estimated';
            }
        }
    }

    return {
        total: results.length,
        accountingCoverage: {usageRuns: results.filter(({usage}) => usage !== undefined).length,
            pricedRuns: results.filter(({cost}) => cost !== undefined).length, totalRuns: results.length},
        passed: results.filter(({status}) => status === 'passed').length,
        failed: results.filter(({status}) => status === 'failed').length,
        incomplete: results.filter(({status}) => status === 'incomplete').length,
        errors: results.filter(({status}) => status === 'error').length,
        totalLatencyMs,
        averageLatencyMs: results.length === 0 ? 0 : totalLatencyMs / results.length,
        ...hasUsage && {usage},
        ...hasCost && {cost: {amount: costAmount, currency: 'USD', source: costSource}}
    };
};

export const runEvaluationSuite = async (options: EvaluationRunOptions): Promise<EvaluationReport> =>
{
    const timeoutMs = options.timeoutMs ?? 120_000;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000) throw new Error('Invalid evaluation timeout');
    const repeat = options.repeat ?? 1;
    if (!Number.isInteger(repeat) || repeat < 1 || repeat > MAX_REPEAT_COUNT)
    {
        throw new Error(`Repeat count must be between 1 and ${MAX_REPEAT_COUNT}`);
    }
    if (options.scenarios.length < 1 || options.scenarios.length > MAX_LIVE_SCENARIOS)
    {
        throw new Error(`Evaluation must contain between 1 and ${MAX_LIVE_SCENARIOS} scenarios`);
    }

    const startedAt = new Date().toISOString();
    const results: EvaluationResult[] = [];

    for (const scenario of options.scenarios)
    {
        for (let iteration = 1; iteration <= repeat; iteration += 1)
        {
            const runId = `${scenario.id}:${iteration}:${crypto.randomUUID()}`;
            const runStartedAt = new Date().toISOString();
            const signal = AbortSignal.timeout(timeoutMs);
            let trace: EvaluationTrace;
            let partial: EvaluationTrace | undefined;
            try
            {
                trace = await abortable(() => options.executor({scenario, runId, signal,
                    retain: (checkpoint) => {if (!signal.aborted) partial = structuredClone(checkpoint);}}), signal);
                if (options.usageResolver)
                {
                    try
                    {
                        const resolved = await abortable(() => options.usageResolver!(scenario, trace), signal);
                        if (resolved.usage && Object.values(resolved.usage).some((value) =>
                            value !== undefined && (!Number.isSafeInteger(value) || value < 0)))
                        {
                            throw new Error('Invalid token accounting');
                        }
                        if (resolved.cost && (!Number.isFinite(resolved.cost.amount) || resolved.cost.amount < 0
                            || resolved.cost.currency !== 'USD' || !['provider', 'estimated'].includes(resolved.cost.source)))
                        {
                            throw new Error('Invalid cost accounting');
                        }
                        if (resolved.cost?.source === 'estimated')
                        {
                            if (!resolved.cost.basis || !trace.model || !resolved.usage
                                || traceAccounting(trace).usageCoverage !== 'complete'
                                || [...trace.trajectory ?? [], trace].some((turn) =>
                                    turn.providerRounds?.some((round) => round.model !== trace.model)))
                            {
                                throw new Error('Unattributed or incomplete estimated cost');
                            }
                            const estimated = estimateEvaluationCost(resolved.cost.basis, trace.model, resolved.usage);
                            if (estimated.amount !== resolved.cost.amount) throw new Error('Inconsistent estimated cost');
                        }
                        trace = {...trace, ...resolved};
                    }
                    catch (error)
                    {
                        trace = {...trace, ...signal.aborted && {outcome: traceFailureOutcome(error, signal)},
                            error: 'Usage/cost accounting failed; execution evidence was retained'};
                    }
                }
            }
            catch (error)
            {
                trace = partial ? {...partial, error: error instanceof Error ? error.message : 'Scenario execution failed',
                    outcome: traceFailureOutcome(error, signal), completedAt: new Date().toISOString()}
                    : {...failedTrace(scenario, runId, runStartedAt, error), traceVersion: 2, outcome: traceFailureOutcome(error, signal)};
            }
            results.push(await evaluateTrace(scenario, trace, options.dataAssertionEvaluator));
        }
    }

    return {
        versions: evaluationVersions(),
        stability: repeatStability(results),
        startedAt,
        completedAt: new Date().toISOString(),
        dataset: {id: DATASET_ID, version: DATASET_VERSION},
        selection: {scenarioIds: options.scenarios.map(({id}) => id), repeat},
        results,
        summary: summarize(results)
    };
};
