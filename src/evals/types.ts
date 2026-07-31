import type {ChatStreamEvent, NluiBlock} from '../nlui/types.ts';
import type {ChatRoundTrace, ChatToolTrace} from '../services/chatTrace.ts';
import type {
    EvaluationBlockName,
    EvaluationScenario,
    EvaluationToolName
} from './scenario.ts';

export interface TokenUsage
{
    inputTokens?: number;
    cachedInputTokens?: number;
    cacheWriteTokens?: number;
    outputTokens?: number;
    reasoningTokens?: number;
    totalTokens?: number;
}

export interface CostEstimate
{
    amount: number;
    currency: 'USD';
    source: 'provider' | 'estimated';
}

export interface EvaluationTraceEvent
{
    sequence: number;
    elapsedMs: number;
    event: ChatStreamEvent;
}

export interface EvaluationLatency
{
    totalMs: number;
    firstTextMs?: number;
    firstUiMs?: number;
}

export interface EvaluationTrace
{
    scenarioId: string;
    runId: string;
    startedAt: string;
    completedAt: string;
    events: EvaluationTraceEvent[];
    text: string;
    toolCalls: string[];
    toolExecutions?: ChatToolTrace[];
    providerRounds?: ChatRoundTrace[];
    blocks: NluiBlock[];
    responseIds: string[];
    model?: string;
    promptVersion?: string;
    latency: EvaluationLatency;
    usage?: TokenUsage;
    cost?: CostEstimate;
    error?: string;
}

export type AssertionStatus = 'passed' | 'failed' | 'not_evaluated';

export interface CheckResult
{
    name: string;
    status: AssertionStatus;
    expected?: string[];
    observed?: string[];
    detail?: string;
}

export interface DataAssertionResult
{
    assertion: string;
    status: AssertionStatus;
    detail?: string;
}

export interface EvaluationExpectations
{
    expectedTools: EvaluationToolName[];
    expectedBlocks: EvaluationBlockName[];
    forbiddenTools: EvaluationToolName[];
    dataAssertions: string[];
}

export type EvaluationStatus = 'passed' | 'failed' | 'incomplete' | 'error';

export interface EvaluationResult
{
    scenarioId: string;
    category: EvaluationScenario['category'];
    runId: string;
    status: EvaluationStatus;
    expectations: EvaluationExpectations;
    observed: {
        tools: string[];
        blocks: EvaluationBlockName[];
    };
    checks: CheckResult[];
    dataAssertions: DataAssertionResult[];
    latency: EvaluationLatency;
    usage?: TokenUsage;
    cost?: CostEstimate;
    error?: string;
    trace: EvaluationTrace;
}

export interface EvaluationReportSummary
{
    total: number;
    passed: number;
    failed: number;
    incomplete: number;
    errors: number;
    totalLatencyMs: number;
    averageLatencyMs: number;
    usage?: TokenUsage;
    cost?: CostEstimate;
}

export interface EvaluationReport
{
    startedAt: string;
    completedAt: string;
    dataset: {
        id: string;
        version: number;
        initialFingerprint?: string;
        finalFingerprint?: string;
        baselineBeforeRun?: boolean;
        baselineAfterRun?: boolean;
        unexpectedMutation?: boolean;
    };
    selection: {
        scenarioIds: string[];
        repeat: number;
    };
    results: EvaluationResult[];
    summary: EvaluationReportSummary;
}

export interface ScenarioExecutionContext
{
    scenario: EvaluationScenario;
    runId: string;
    signal: AbortSignal;
}

export type ScenarioExecutor = (context: ScenarioExecutionContext) => Promise<EvaluationTrace>;

export type DataAssertionEvaluator = (
    scenario: EvaluationScenario,
    trace: EvaluationTrace
) => Promise<DataAssertionResult[]> | DataAssertionResult[];

export type UsageResolver = (
    scenario: EvaluationScenario,
    trace: EvaluationTrace
) => Promise<{usage?: TokenUsage; cost?: CostEstimate}> | {usage?: TokenUsage; cost?: CostEstimate};
