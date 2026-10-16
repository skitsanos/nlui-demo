import {z} from 'zod';

// Intentionally not the AntV options schema. No assets, SVG, URLs, styles or actions cross this boundary.
const text = (max: number) => z.string().trim().min(1).max(max).regex(/^[^<>&]*$/)
    .refine((value) => [...value].every((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127), 'Control characters are not permitted')
    .refine((value) => !/(?:https?:|javascript:|data:|ref:)/i.test(value), 'Resource references are not permitted');
export const INFOGRAPHIC_VIEWS = ['comparison', 'timeline', 'process'] as const;
export const infographicBlockSchema = z.object({
    id: z.string().min(1).max(120),
    type: z.literal('infographic'),
    view: z.enum(INFOGRAPHIC_VIEWS),
    title: text(120),
    description: text(320),
    snapshot: z.iso.datetime(),
    items: z.array(z.object({
        label: text(80), detail: text(800), value: z.number().finite().nonnegative().optional(), at: z.iso.datetime().optional()
    }).strict()).min(1).max(10),
    provenance: z.object({
        source: z.enum(['dataset:regional-revenue', 'dataset:order-events', 'knowledge/returns-policy.md']),
        fingerprint: z.string().regex(/^[a-f0-9]{64}$/), scope: text(320)
    }).strict()
}).strict().superRefine((block, context) =>
{
    const fail = (message: string) => context.addIssue({code: 'custom', message});
    if (new Set(block.items.map(({label}) => label)).size !== block.items.length) fail('Labels must be unique');
    if (block.view === 'comparison')
    {
        if (block.items.length !== 2 || block.items.some(({value, at}) => value === undefined || at !== undefined)
            || block.provenance.source !== 'dataset:regional-revenue') fail('Comparison requires two verified EUR values');
    }
    else if (block.view === 'timeline')
    {
        if (block.provenance.source !== 'dataset:order-events' || block.items.some(({at, value}, index) =>
            !at || value !== undefined || at > block.snapshot || index > 0 && at < block.items[index - 1]!.at!))
            fail('Timeline requires ordered observed timestamps, not forecasts');
    }
    else if (block.items.length < 2 || block.items.length > 6 || block.items.some(({at, value}) => at !== undefined || value !== undefined)
        || block.provenance.source !== 'knowledge/returns-policy.md') fail('Process requires bounded policy-backed steps');
});

export type InfographicBlock = z.infer<typeof infographicBlockSchema> & {analysis?: never; controlExpiresAt?: never};
