import type {ChatStreamEvent, NluiBlock} from '../nlui/types.ts';
import {
    addTokenUsage,
    type ChatRoundTrace,
    type ChatRunResult,
    type ChatToolTrace,
    emptyTokenUsage
} from '../services/chatTrace.ts';
import {CHAT_PROMPT_VERSION, runOpenAIChat} from '../services/openaiChat.ts';
import {executionFor} from './scenario.ts';
import type {EvaluationTrace, ScenarioExecutor} from './types.ts';

type ChatRunner = (
    request: Parameters<typeof runOpenAIChat>[0],
    emit: Parameters<typeof runOpenAIChat>[1],
    signal: AbortSignal,
    observe?: Parameters<typeof runOpenAIChat>[3]
) => Promise<ChatRunResult | undefined>;

export interface OpenAIExecutorOptions
{
    chatRunner?: ChatRunner;
}

export const createOpenAIExecutor = (options: OpenAIExecutorOptions = {}): ScenarioExecutor =>
    async ({scenario, runId, signal}) =>
    {
        const execution = executionFor(scenario);
        if (scenario.setup)
        {
            throw new Error('Scenario setup requires an explicit, isolated setup adapter');
        }
        if (execution.mode !== 'single-turn')
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

        const emit = (event: ChatStreamEvent): void =>
        {
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
        };

        let error: string | undefined;
        const chatResult = await (options.chatRunner ?? runOpenAIChat)({
                conversationId: `eval-${crypto.randomUUID()}`,
                input: {type: 'user_text', text: scenario.prompt}
            }, emit, signal, (event) =>
            {
                if (event.type === 'round.completed') observedRounds.push(event.round);
                else observedTools.push(event.tool);
            }).catch((cause: unknown) =>
        {
            error = cause instanceof Error ? cause.message : 'OpenAI evaluation failed';
            return undefined;
        });

        const tracedTools = chatResult?.tools ?? observedTools;
        const tracedRounds = chatResult?.rounds ?? observedRounds;
        if (tracedTools.length > 0)
        {
            toolCalls.splice(0, toolCalls.length, ...tracedTools.map(({name}) => name));
        }
        if (tracedRounds.length > 0)
        {
            responseIds.splice(0, responseIds.length, ...tracedRounds.map(({responseId}) => responseId));
        }
        const tracedUsage = emptyTokenUsage();
        for (const round of tracedRounds) addTokenUsage(tracedUsage, round.usage);
        if (chatResult && tracedRounds.length === 0) addTokenUsage(tracedUsage, chatResult.usage);
        const hasInternalTrace = chatResult !== undefined || tracedRounds.length > 0 || tracedTools.length > 0;

        const completedAt = new Date().toISOString();
        const trace: EvaluationTrace = {
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
