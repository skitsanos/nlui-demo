import type {ResponseTextConfig} from 'openai/resources/responses/responses';
import {z} from 'zod';
import {nluiBlocksSchema} from '../nlui/schemas.ts';
import type {NluiBlock} from '../nlui/types.ts';

export const MAX_RESPONSE_BLOCKS = 12;
const MAX_CAPTION_LENGTH = 280;
const interactiveTypes = new Set<NluiBlock['type']>(['choices', 'form', 'confirmation']);

const responseEnvelopeSchema = z.object({
    presentation: z.enum(['message', 'blocks']),
    answer: z.string().nullable(),
    caption: z.string().nullable(),
    block_ids: z.array(z.string()).max(MAX_RESPONSE_BLOCKS)
}).strict();

export type StructuredResponseEnvelope = z.infer<typeof responseEnvelopeSchema>;

export interface ResolvedAssistantResponse
{
    envelope: StructuredResponseEnvelope;
    text: string;
    blocks: NluiBlock[];
}

export class StructuredResponseError extends Error
{
    constructor()
    {
        super('The model returned an invalid structured response.');
        this.name = 'StructuredResponseError';
    }
}

const blockCaptionSchema = {
    type: 'string',
    minLength: 1,
    maxLength: MAX_CAPTION_LENGTH,
    description: 'A brief conversational annotation that adds context or one useful takeaway without repeating data already rendered in the selected blocks.'
};

export const responseTextConfigFor = (blocks: NluiBlock[]): ResponseTextConfig =>
{
    const ids = blocks.map(({id}) => id);
    const hasBlocks = ids.length > 0;
    return {
        format: {
            type: 'json_schema',
            name: 'nlui_assistant_response',
            description: 'Selects either a prose answer or trusted server-owned UI blocks with a brief non-duplicative annotation.',
            strict: true,
            schema: {
                type: 'object',
                properties: {
                    presentation: {
                        type: 'string',
                        enum: [hasBlocks ? 'blocks' : 'message']
                    },
                    answer: hasBlocks ? {type: 'null'} : {
                        type: 'string',
                        minLength: 1,
                        description: 'The complete concise user-facing Markdown answer.'
                    },
                    caption: hasBlocks ? blockCaptionSchema : {type: 'null'},
                    block_ids: hasBlocks ? {
                        type: 'array',
                        items: {type: 'string', enum: ids},
                        minItems: 1,
                        maxItems: ids.length,
                        description: 'Unique identifiers selected from the trusted blocks made available by tools.'
                    } : {
                        type: 'array',
                        items: {type: 'string'},
                        maxItems: 0
                    }
                },
                required: ['presentation', 'answer', 'caption', 'block_ids'],
                additionalProperties: false
            }
        }
    };
};

export const modelToolOutput = (result: unknown, blocks: NluiBlock[]): string => JSON.stringify({
    result,
    ui: {
        available_blocks: blocks.map(({id, type, title, description}) => ({
            id,
            type,
            ...title && {title},
            ...description && {description},
            required: interactiveTypes.has(type)
        }))
    }
});

const invalid = (): never =>
{
    throw new StructuredResponseError();
};

export const resolveStructuredResponse = (encoded: string, candidates: NluiBlock[]): ResolvedAssistantResponse =>
{
    const parsedJson = (() =>
    {
        try
        {
            return JSON.parse(encoded) as unknown;
        }
        catch
        {
            return invalid();
        }
    })();
    const parsed = responseEnvelopeSchema.safeParse(parsedJson);
    if (!parsed.success) return invalid();

    const envelope = parsed.data;
    const validatedCandidates = nluiBlocksSchema.safeParse(candidates);
    if (!validatedCandidates.success) return invalid();
    const candidatesById = new Map(validatedCandidates.data.map((block) => [block.id, block]));
    if (candidatesById.size !== validatedCandidates.data.length) return invalid();

    if (candidates.length === 0)
    {
        if (envelope.presentation !== 'message' || !envelope.answer?.trim()
            || envelope.caption !== null || envelope.block_ids.length !== 0)
        {
            return invalid();
        }
        return {envelope, text: envelope.answer, blocks: []};
    }

    if (envelope.presentation !== 'blocks' || envelope.answer !== null
        || !envelope.caption?.trim()
        || envelope.caption.length > MAX_CAPTION_LENGTH
        || envelope.block_ids.length === 0
        || new Set(envelope.block_ids).size !== envelope.block_ids.length)
    {
        return invalid();
    }

    const selected = envelope.block_ids.map((id) => candidatesById.get(id) ?? invalid());
    const selectedIds = new Set(envelope.block_ids);
    if (validatedCandidates.data.some((block) => interactiveTypes.has(block.type) && !selectedIds.has(block.id)))
    {
        return invalid();
    }
    const blocks = nluiBlocksSchema.safeParse(selected);
    if (!blocks.success) return invalid();
    return {envelope, text: envelope.caption, blocks: blocks.data};
};

export const refusalResponse = (text: string): ResolvedAssistantResponse => ({
    envelope: {presentation: 'message', answer: text, caption: null, block_ids: []},
    text,
    blocks: []
});
