import type {CellValue, FormField, ResultBlock} from './types.ts';

export type InteractionValues = Record<string, CellValue | CellValue[]>;
export type InteractionCapabilityErrorCode =
    | 'unknown'
    | 'consumed'
    | 'expired'
    | 'conversation_mismatch'
    | 'action_not_completed'
    | 'invalid_payload';

export class InteractionCapabilityError extends Error
{
    constructor(readonly code: InteractionCapabilityErrorCode)
    {
        super('This interaction is invalid or no longer available.');
        this.name = 'InteractionCapabilityError';
    }
}

export type FieldRule =
    | {kind: 'text'; required: boolean; maxLength: number}
    | {kind: 'number'; required: boolean; min?: number; max?: number}
    | {kind: 'select'; required: boolean; options: Set<string>}
    | {kind: 'date'; required: boolean};

export type Capability =
    | {kind: 'form'; fields: Map<string, FieldRule>}
    | {kind: 'choices'; multiple: boolean; options: Set<string>}
    | {
        kind: 'confirmation';
        actionId: string;
        state: 'issued' | 'executing' | 'completed';
        result?: ResultBlock;
    };

export type ConfirmationReservation =
    | {status: 'execute'}
    | {status: 'completed'; block: ResultBlock};

export const fieldRule = (field: FormField): FieldRule =>
{
    const required = field.required === true;
    if (field.input === 'text' || field.input === 'textarea')
    {
        return {kind: 'text', required, maxLength: field.maxLength ?? 1_000};
    }
    if (field.input === 'number')
    {
        return {kind: 'number', required, min: field.min, max: field.max};
    }
    if (field.input === 'select')
    {
        return {kind: 'select', required, options: new Set(field.options.map(({value}) => value))};
    }
    return {kind: 'date', required};
};
