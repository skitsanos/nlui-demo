import OpenAI from 'openai';
import {redactConfiguredText} from '../evals/reportRedaction.ts';
import type {NluiBlock} from '../nlui/types.ts';
import {resolveStructuredResponse, responseTextConfigFor} from '../services/structuredResponse.ts';
import type {ProviderRequestBudget} from './budget.ts';

// One matched composition task, not a statistically powered model comparison.
export const runControlSurface = async (blocks: NluiBlock[], budget: ProviderRequestBudget) =>
{
    const apiKey = process.env.OPENAI_API_KEY?.trim(); const model = process.env.CHAT_MODEL?.trim();
    if (!apiKey || !model) throw new Error('Existing provider configuration is required.');
    const client = new OpenAI({apiKey, maxRetries: 0});
    const reservation = budget.reserve('surface-4:controlled-baseline'); const started = performance.now();
    let encoded = ''; let known = false;
    let usage = {inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0};
    try
    {
        const stream = await client.responses.create({model, store: false, stream: true, max_output_tokens: 1800,
            instructions: 'Select every supplied trusted block exactly once and write one brief conversational caption. Never invent data, component definitions, URLs, validation or actions. answer must be null. Use presentation blocks.',
            input: JSON.stringify({available: blocks.map(({id, type, title}) => ({id, type, title}))}),
            text: responseTextConfigFor(blocks)}, {signal: AbortSignal.timeout(90_000)});
        let completed = false;
        for await (const event of stream)
        {
            if (event.type === 'response.output_text.delta') encoded += event.delta;
            if (event.type === 'response.completed')
            {
                completed = event.response.status === 'completed'; known = !!event.response.usage;
                const u = event.response.usage;
                usage = {inputTokens: u?.input_tokens ?? 0, cachedInputTokens: u?.input_tokens_details.cached_tokens ?? 0, cacheWriteTokens: 0,
                    outputTokens: u?.output_tokens ?? 0, reasoningTokens: u?.output_tokens_details.reasoning_tokens ?? 0, totalTokens: u?.total_tokens ?? 0};
            }
        }
        budget.account(reservation, {round: 1, responseId: '', model: '', durationMs: performance.now() - started, usage, usageKnown: known});
        if (!completed) throw new Error('Incomplete controlled composition.');
        const response = resolveStructuredResponse(encoded, blocks);
        return {id: 'surface-4-controlled-baseline', pass: response.blocks.length === blocks.length, usage, usageComplete: known,
            firstUsefulMs: performance.now() - started, totalMs: performance.now() - started,
            bytes: new TextEncoder().encode(encoded).byteLength};
    }
    catch (error) {return {id: 'surface-4-controlled-baseline', pass: false, usage, usageComplete: known, totalMs: performance.now() - started,
        error: redactConfiguredText(error instanceof Error ? error.message : 'Controlled composition failed.')};}
};
