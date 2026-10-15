import OpenAI from 'openai';
import {z} from 'zod';
import {redactConfiguredText} from '../evals/reportRedaction.ts';
import {A2UI_CATALOG_ID, a2uiCommandSchema, qualifySurface} from '../nlui/a2ui/adapter.ts';
import type {NluiBlock} from '../nlui/types.ts';
import type {ProviderRequestBudget} from './budget.ts';

export const surfaceEnvelopeSchema = z.object({commands: z.array(a2uiCommandSchema).min(3).max(8)}).strict();
export const surfaceResponseSchema = (blocks: NluiBlock[]): Record<string, unknown> =>
{
    const {$schema: _schema, ...schema} = z.toJSONSchema(surfaceEnvelopeSchema);
    const convert = (node: any): any =>
    {
        if (Array.isArray(node)) return node.map(convert);
        if (!node || typeof node !== 'object') return node;
        const copy = Object.fromEntries(Object.entries(node).map(([key, value]) => [key === 'oneOf' ? 'anyOf' : key, convert(value)]));
        if (copy.properties?.updateDataModel)
        {
            const properties = Object.fromEntries([['caption', {type: 'string', maxLength: 500}], ...blocks.map((block, index) => [`block${index}`, {type: 'string', enum: [block.id]}])]);
            copy.properties.updateDataModel.properties.value = {type: 'object', properties, required: Object.keys(properties), additionalProperties: false};
        }
        return copy;
    };
    return convert(schema);
};
export const runResearchSurface = async (blocks: NluiBlock[], id: string, budget: ProviderRequestBudget) =>
{
    const apiKey = process.env.OPENAI_API_KEY?.trim(); const model = process.env.CHAT_MODEL?.trim();
    if (!apiKey || !model) throw new Error('Existing provider configuration is required.');
    const client = new OpenAI({apiKey, maxRetries: 0});
    const schema = surfaceResponseSchema(blocks);
    const started = performance.now(); const reservation = budget.reserve(`a2ui:${id}`);
    let encoded = ''; let known = false; let usage = {inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0};
    try
    {
        const stream = await client.responses.create({model, store: false, stream: true, max_output_tokens: 1800,
            instructions: `Build one A2UI v0.9 surface using only catalog ${A2UI_CATALOG_ID}. Emit createSurface, updateComponents and updateDataModel in that order. Include root Column, one short Text caption with {path:"/caption"}, and exactly one appropriate Metric/Chart/Table/Choice/Form/Notice component per supplied block, using its exact blockRef ID. No URLs, action names, validation, HTML, extra props or inferred data. Do not emit Button or omit/duplicate a block. Use surfaceId "experiment".`,
            input: JSON.stringify({available: blocks.map(({id, type, title}) => ({id, type, title}))}),
            text: {format: {type: 'json_schema', name: 'owned_a2ui_experiment', strict: true, schema}}}, {signal: AbortSignal.timeout(90_000)});
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
        if (!completed) throw new Error('Incomplete surface response.');
        const {commands} = surfaceEnvelopeSchema.parse(JSON.parse(encoded));
        qualifySurface(commands, blocks);
        return {id, pass: true, repairRequests: 0, commandCount: commands.length, componentCount: commands.flatMap((c) => 'updateComponents' in c ? c.updateComponents.components : []).length,
            firstUsefulMs: performance.now() - started, totalMs: performance.now() - started, usage, usageComplete: known,
            // Structured envelopes are buffered; no speculative progressive latency benefit is claimed.
            streamingPolicy: 'buffered-model-envelope-validated-progressive-adapter', commands};
    }
    catch (error) {return {id, pass: false, totalMs: performance.now() - started, usage, usageComplete: known, repairRequests: 0,
        error: redactConfiguredText(error instanceof Error ? error.message : 'Surface request failed.')};}
};
