import type {ChatStreamEvent, NluiBlock} from '../nlui/types.ts';
import {
    addTokenUsage,
    type ChatRoundTrace,
    type ChatRunResult,
    type ChatToolTrace,
    emptyTokenUsage
} from '../services/chatTrace.ts';
import {CHAT_PROMPT_VERSION, runOpenAIChat} from '../services/openaiChat.ts';
import {abortable} from '../utils/abort.ts';
import type {EvaluationScenario} from './scenario.ts';
import {executionFor} from './scenario.ts';
import type {EvaluationTrace, ScenarioExecutionContext, ScenarioExecutor} from './types.ts';

export type ChatRunner = (
    request: Parameters<typeof runOpenAIChat>[0],
    emit: Parameters<typeof runOpenAIChat>[1],
    signal: AbortSignal,
    observe?: Parameters<typeof runOpenAIChat>[3]
) => Promise<ChatRunResult | undefined>;

export interface OpenAIExecutorOptions
{
    chatRunner?: ChatRunner;
    scenarios?: EvaluationScenario[];
}

const executeTurn = async (
    options: OpenAIExecutorOptions, {scenario, runId, signal, retain}: ScenarioExecutionContext,
    conversationId: string, previousResponseId?: string
): Promise<EvaluationTrace> =>
    {
        const execution = executionFor(scenario);
        if (scenario.setup)
        {
            throw new Error('Scenario setup requires an explicit, isolated setup adapter');
        }
        if (execution.mode !== 'single-turn' && execution.mode !== 'multi-turn')
        {
            throw new Error(`Scenario execution mode ${execution.mode} requires a dedicated adapter`);
        }

        const startedAt = new Date().toISOString();
        const started = performance.now();
        const events: Array<{sequence: number; elapsedMs: number; event: ChatStreamEvent}> = [];
        const toolCalls: string[] = [];
        const blocks: NluiBlock[] = [];
        const responseIds: string[] = [];
        let text = '';
        let firstTextMs: number | undefined;
        let firstUiMs: number | undefined;
        const observedRounds: ChatRoundTrace[] = [];
        const observedTools: ChatToolTrace[] = [];
        let accepting = true;
        const checkpoint = (): void =>
        {
            if (!retain) return;
            const usage = emptyTokenUsage();
            for (const round of observedRounds) addTokenUsage(usage, round.usage);
            retain({traceVersion: 2, outcome: 'incomplete', scenarioId: scenario.id, runId, startedAt,
                completedAt: new Date().toISOString(), events: [...events], text, toolCalls: [...toolCalls], blocks: [...blocks],
                responseIds: [...responseIds], providerRounds: [...observedRounds], toolExecutions: [...observedTools], usage,
                latency: {totalMs: performance.now() - started}});
        };

        const emit = (event: ChatStreamEvent): void =>
        {
            if (!accepting) return;
            const elapsedMs = performance.now() - started;
            events.push({sequence: events.length + 1, elapsedMs, event});
            if (event.type === 'tool.started')
            {
                toolCalls.push(event.name);
            }
            else if (event.type === 'text.delta')
            {
                text += event.delta;
                firstTextMs ??= elapsedMs;
            }
            else if (event.type === 'ui.block')
            {
                blocks.push(event.block);
                firstUiMs ??= elapsedMs;
            }
            else if (event.type === 'message.completed')
            {
                responseIds.push(event.responseId);
            }
            checkpoint();
        };

        let error: string | undefined;
        const chatResult = await abortable(() => (options.chatRunner ?? runOpenAIChat)({
                conversationId,
                ...previousResponseId && {previousResponseId},
                input: {type: 'user_text', text: scenario.prompt}
            }, emit, signal, (event) =>
            {
                if (!accepting) return;
                if (event.type === 'round.completed') observedRounds.push(event.round);
                else observedTools.push(event.tool);
                checkpoint();
            }), signal).catch((cause: unknown) =>
        {
            error = cause instanceof Error ? cause.message : 'OpenAI evaluation failed';
            return undefined;
        });
        accepting = false;
        const terminalCount = events.filter(({event}) => event.type === 'message.completed').length;
        const outcome: EvaluationTrace['outcome'] = signal.aborted
            ? signal.reason?.name === 'TimeoutError' ? 'timeout' : 'cancelled'
            : error ? /incomplete/i.test(error) ? 'incomplete' : /without successful completion/i.test(error) ? 'truncated' : 'error'
                : terminalCount === 1 ? 'completed' : 'truncated';
        if (terminalCount !== 1 && !error) error = 'Evaluation did not observe exactly one terminal completion';

        const tracedTools = chatResult?.tools ?? observedTools;
        const tracedRounds = chatResult?.rounds ?? observedRounds;
        if (tracedTools.length > 0)
        {
            toolCalls.splice(0, toolCalls.length, ...tracedTools.map(({name}) => name));
        }
        if (tracedRounds.length > 0)
        {
            responseIds.splice(0, responseIds.length, ...tracedRounds.map(({responseId}) => responseId).filter(Boolean));
        }
        const tracedUsage = emptyTokenUsage();
        for (const round of tracedRounds) addTokenUsage(tracedUsage, round.usage);
        if (chatResult && tracedRounds.length === 0) addTokenUsage(tracedUsage, chatResult.usage);
        const hasInternalTrace = chatResult !== undefined || tracedRounds.length > 0 || tracedTools.length > 0;

        const completedAt = new Date().toISOString();
        const trace: EvaluationTrace = {
            traceVersion: 2,
            outcome,
            scenarioId: scenario.id,
            runId,
            startedAt,
            completedAt,
            events,
            text,
            toolCalls,
            blocks,
            responseIds,
            ...hasInternalTrace && {
                toolExecutions: tracedTools,
                providerRounds: tracedRounds,
                model: chatResult?.model ?? tracedRounds.at(-1)?.model,
                promptVersion: chatResult?.promptVersion ?? CHAT_PROMPT_VERSION,
                usage: {
                    inputTokens: tracedUsage.inputTokens,
                    cachedInputTokens: tracedUsage.cachedInputTokens,
                    cacheWriteTokens: tracedUsage.cacheWriteTokens,
                    outputTokens: tracedUsage.outputTokens,
                    reasoningTokens: tracedUsage.reasoningTokens,
                    totalTokens: tracedUsage.totalTokens
                }
            },
            latency: {
                totalMs: performance.now() - started,
                ...firstTextMs !== undefined && {firstTextMs},
                ...firstUiMs !== undefined && {firstUiMs}
            },
            ...error && {error}
        };

        return trace;
    };

export const createOpenAIExecutor = (options: OpenAIExecutorOptions = {}): ScenarioExecutor => async (context) =>
{
    const totalUsage = (turns: EvaluationTrace[]) =>
    {
        const usage = emptyTokenUsage();
        for (const turn of turns) for (const key of Object.keys(usage) as Array<keyof typeof usage>) usage[key] += turn.usage?.[key] ?? 0;
        return usage;
    };
    const chain: EvaluationScenario[] = [];
    const visiting = new Set<string>();
    const seen = new Set<string>();
    const catalog = new Map((options.scenarios ?? []).map((scenario) => [scenario.id, scenario]));
    const append = (scenario: EvaluationScenario): void =>
    {
        if (visiting.has(scenario.id) || chain.length >= 8) throw new Error('Invalid or excessive evaluation trajectory');
        if (seen.has(scenario.id)) return;
        visiting.add(scenario.id);
        const execution = executionFor(scenario);
        if (execution.mode === 'multi-turn') for (const id of execution.priorScenarioIds)
        {
            const prior = catalog.get(id);
            if (!prior) throw new Error(`Missing trajectory prerequisite ${id}`);
            append(prior);
        }
        visiting.delete(scenario.id);
        seen.add(scenario.id);
        chain.push(scenario);
    };
    append(context.scenario);
    const conversationId = `eval-${crypto.randomUUID()}`;
    const turns: EvaluationTrace[] = [];
    let previousResponseId: string | undefined;
    for (const scenario of chain)
    {
        const turn = await executeTurn(options, {...context, scenario, retain: (partial) => context.retain?.({
            ...partial, scenarioId: context.scenario.id, trajectory: [...turns], usage: totalUsage([...turns, partial])
        })}, conversationId, previousResponseId);
        turns.push(turn);
        if (turn.outcome !== 'completed') break;
        previousResponseId = turn.responseIds.at(-1);
    }
    const last = turns.at(-1)!;
    const usage = totalUsage(turns);
    const offset = turns.slice(0, -1).reduce((sum, turn) => sum + turn.latency.totalMs, 0);
    return {...last, scenarioId: context.scenario.id, runId: context.runId,
        ...turns.length > 1 && {trajectory: turns.slice(0, -1), usage,
            startedAt: turns[0]!.startedAt, latency: {totalMs: offset + last.latency.totalMs,
                ...last.latency.firstTextMs !== undefined && {firstTextMs: offset + last.latency.firstTextMs},
                ...last.latency.firstUiMs !== undefined && {firstUiMs: offset + last.latency.firstUiMs}}}};
};
