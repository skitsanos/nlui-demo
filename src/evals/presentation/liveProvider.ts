import OpenAI from 'openai';
import type {Response as ProviderResponse} from 'openai/resources/responses/responses';
import type {selectionRequest} from './liveProtocol.ts';

export type SelectionProvider = (request: ReturnType<typeof selectionRequest>, signal: AbortSignal) => Promise<ProviderResponse>;
export const selectionProvider = (apiKey: string, model: string, transport?: typeof fetch): SelectionProvider =>
{
    const client = new OpenAI({apiKey, maxRetries: 0, timeout: 45_000, logLevel: 'off', ...transport && {fetch: transport}});
    return async (request, signal) => await client.responses.create({...request, model}, {signal});
};
export const selectionOutput = (response: ProviderResponse): string => response.output_text || response.output.filter((item) => item.type === 'message')
    .flatMap((item) => item.content.filter((part) => part.type === 'output_text').map((part) => part.text)).join('');
export const selectionUsage = (response: ProviderResponse) =>
{
    const u = response.usage;
    if (!u) return null;
    const numbers = [u.input_tokens, u.output_tokens, u.total_tokens, u.input_tokens_details?.cached_tokens, u.output_tokens_details?.reasoning_tokens];
    if (!numbers.every((n) => Number.isSafeInteger(n) && n >= 0) || u.total_tokens !== u.input_tokens + u.output_tokens
        || numbers[3]! > u.input_tokens || numbers[4]! > u.output_tokens) return null;
    return {inputTokens: u.input_tokens, cachedInputTokens: u.input_tokens_details?.cached_tokens ?? 0,
        outputTokens: u.output_tokens, reasoningTokens: u.output_tokens_details?.reasoning_tokens ?? 0,
        totalTokens: u.total_tokens, cacheWriteTokens: 0};
};
