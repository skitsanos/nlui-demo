import type {FieldRule, InteractionValues} from './interactionCapabilityTypes.ts';
import type {CellValue} from './types.ts';

export type FormInputValues = Record<string, CellValue | CellValue[] | undefined>;

/** Undefined follows JSON omission; only issued optional numbers also omit null. */
export const normalizeFormValues = (
    fields: ReadonlyMap<string, FieldRule>, values: FormInputValues
): InteractionValues => Object.fromEntries(Object.entries(values).flatMap(([name, value]) =>
{
    const rule = fields.get(name);
    // Retain an unknown key for rejection even when JSON would otherwise drop it.
    if (value === undefined) return rule ? [] : [[name, null]];
    if (rule?.kind === 'number' && !rule.required && value === null) return [];
    return [[name, value]];
}));
