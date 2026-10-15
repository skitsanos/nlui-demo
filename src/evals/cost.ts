import {z} from 'zod';
import type {CostEstimate, TokenUsage} from './types.ts';

const pricingSchema = z.object({version: z.string().min(1), sourceUrl: z.url(), effectiveAt: z.iso.date(),
    model: z.string().min(1), inputPerMillion: z.number().finite().nonnegative(),
    cachedInputPerMillion: z.number().finite().nonnegative(), outputPerMillion: z.number().finite().nonnegative()}).strict();
export type EvaluationPricing = z.infer<typeof pricingSchema>;

// No default rates: callers must provide a versioned, attributable pricing source.
export const estimateEvaluationCost = (raw: EvaluationPricing, model: string, usage: TokenUsage): CostEstimate =>
{
    const pricing = pricingSchema.parse(raw);
    if (pricing.model !== model) throw new Error('Pricing model does not match observed model');
    const {inputTokens, cachedInputTokens, outputTokens} = usage;
    if ([inputTokens, cachedInputTokens, outputTokens].some((value) => value === undefined || !Number.isSafeInteger(value) || value < 0)
        || cachedInputTokens! > inputTokens!) throw new Error('Complete valid input/cache/output usage is required for estimated cost');
    const amount = ((inputTokens! - cachedInputTokens!) * pricing.inputPerMillion
        + cachedInputTokens! * pricing.cachedInputPerMillion + outputTokens! * pricing.outputPerMillion) / 1_000_000;
    if (!Number.isFinite(amount)) throw new Error('Estimated cost exceeds finite numeric range');
    return {amount,
        currency: 'USD', source: 'estimated', basis: {version: pricing.version, sourceUrl: pricing.sourceUrl,
            effectiveAt: pricing.effectiveAt, model, inputPerMillion: pricing.inputPerMillion,
            cachedInputPerMillion: pricing.cachedInputPerMillion, outputPerMillion: pricing.outputPerMillion}};
};
