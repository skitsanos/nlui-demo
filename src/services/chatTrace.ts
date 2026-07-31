import type {NluiBlock} from '../nlui/types.ts';

export interface ChatTokenUsage
{
    inputTokens: number;
    cachedInputTokens: number;
    cacheWriteTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    totalTokens: number;
}

export interface ChatToolTrace
{
    round: number;
    callId: string;
    name: string;
    arguments: unknown;
    modelOutput: unknown;
    candidateBlockIds: string[];
    candidateBlockTypes: NluiBlock['type'][];
    durationMs: number;
    cached: boolean;
    rejected: boolean;
}

export interface ChatRoundTrace
{
    round: number;
    responseId: string;
    model: string;
    durationMs: number;
    usage: ChatTokenUsage;
}

export interface ChatRunResult
{
    messageId: string;
    responseId: string;
    model: string;
    promptVersion: string;
    text: string;
    blocks: NluiBlock[];
    tools: ChatToolTrace[];
    rounds: ChatRoundTrace[];
    usage: ChatTokenUsage;
    durationMs: number;
}

export type ChatTraceProgressEvent =
    | {type: 'round.completed'; round: ChatRoundTrace}
    | {type: 'tool.completed'; tool: ChatToolTrace};

export const emptyTokenUsage = (): ChatTokenUsage => ({
    inputTokens: 0,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0
});

export const addTokenUsage = (target: ChatTokenUsage, usage: ChatTokenUsage): void =>
{
    target.inputTokens += usage.inputTokens;
    target.cachedInputTokens += usage.cachedInputTokens;
    target.cacheWriteTokens += usage.cacheWriteTokens;
    target.outputTokens += usage.outputTokens;
    target.reasoningTokens += usage.reasoningTokens;
    target.totalTokens += usage.totalTokens;
};
