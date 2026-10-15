import {z} from 'zod';

export const PRODUCT_FACT_KEYS = ['batteryHours', 'weightKg', 'ramGb', 'storageGb', 'resolution'] as const;
export const productFactSchema = z.union([
    z.object({key: z.enum(['batteryHours', 'weightKg', 'ramGb', 'storageGb']), value: z.number().finite().positive()}).strict(),
    z.object({key: z.literal('resolution'), value: z.string().regex(/^\d{3,5}x\d{3,5}$/)}).strict()
]);
export type ProductFact = z.infer<typeof productFactSchema>;

export const productFacts = (attributes: Record<string, unknown>): ProductFact[] => PRODUCT_FACT_KEYS.flatMap((key) =>
{
    const parsed = productFactSchema.safeParse({key, value: attributes[key]});
    return parsed.success ? [parsed.data] : [];
});

export const factPresentation = (fact: ProductFact): {label: string; value: string} =>
{
    switch (fact.key)
    {
        case 'batteryHours': return {label: 'Battery life', value: `${fact.value} hours`};
        case 'weightKg': return {label: 'Weight', value: `${Number(Number(fact.value).toFixed(2))} kg`};
        case 'ramGb': return {label: 'RAM', value: `${fact.value} GB`};
        case 'storageGb': return {label: 'Storage', value: `${fact.value} GB`};
        default: return {label: 'Resolution', value: String(fact.value).replace('x', ' × ')};
    }
};
