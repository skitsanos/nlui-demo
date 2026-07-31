import {
    type Capability,
    fieldRule,
    InteractionCapabilityError,
    type InteractionValues
} from './interactionCapabilityTypes.ts';
import type {CellValue, NluiBlock} from './types.ts';

const invalidPayload = (): never =>
{
    throw new InteractionCapabilityError('invalid_payload');
};

export const capabilityFor = (
    block: NluiBlock
): {interactionId: string; capability: Capability} | undefined =>
{
    if (block.type === 'form')
    {
        return {
            interactionId: block.interactionId,
            capability: {kind: 'form', fields: new Map(block.fields.map((field) => [field.name, fieldRule(field)]))}
        };
    }
    if (block.type === 'choices')
    {
        return {
            interactionId: block.interactionId,
            capability: {
                kind: 'choices',
                multiple: block.multiple === true,
                options: new Set(block.options.map(({value}) => value))
            }
        };
    }
    if (block.type === 'confirmation')
    {
        return {
            interactionId: block.id,
            capability: {kind: 'confirmation', actionId: block.actionId, state: 'issued'}
        };
    }
    return undefined;
};

const hasExactKeys = (values: InteractionValues, allowed: Set<string>): boolean =>
    Object.keys(values).every((key) => allowed.has(key));

const isValidDate = (value: string): boolean =>
{
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const timestamp = Date.parse(`${value}T00:00:00.000Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
};

const validateField = (rule: import('./interactionCapabilityTypes.ts').FieldRule, value?: CellValue | CellValue[]): void =>
{
    if (value === undefined)
    {
        if (rule.required) invalidPayload();
        return;
    }
    if (rule.kind === 'text')
    {
        if (typeof value !== 'string' || value.length > rule.maxLength || (rule.required && !value.trim())) invalidPayload();
        return;
    }
    if (rule.kind === 'number')
    {
        if (typeof value !== 'number' || !Number.isFinite(value)
            || rule.min !== undefined && value < rule.min
            || rule.max !== undefined && value > rule.max) invalidPayload();
        return;
    }
    if (rule.kind === 'select')
    {
        if (typeof value !== 'string' || !rule.options.has(value)) invalidPayload();
        return;
    }
    if (typeof value !== 'string' || !isValidDate(value)) invalidPayload();
};

const validateForm = (capability: Extract<Capability, {kind: 'form'}>, values: InteractionValues): void =>
{
    if (!hasExactKeys(values, new Set(capability.fields.keys()))) invalidPayload();
    for (const [name, rule] of capability.fields) validateField(rule, values[name]);
};

const validateChoices = (capability: Extract<Capability, {kind: 'choices'}>, values: InteractionValues): void =>
{
    if (!hasExactKeys(values, new Set(['selection'])) || !Object.hasOwn(values, 'selection')) invalidPayload();
    const selection = values.selection;
    const selected = Array.isArray(selection) ? selection : [selection];
    if (selected.length === 0 || selected.some((value) => typeof value !== 'string' || !capability.options.has(value)))
    {
        invalidPayload();
    }
    if (capability.multiple && (!Array.isArray(selection) || new Set(selected).size !== selected.length)) invalidPayload();
    if (!capability.multiple && Array.isArray(selection)) invalidPayload();
};

const validateConfirmation = (
    capability: Extract<Capability, {kind: 'confirmation'}>,
    values: InteractionValues
): void =>
{
    const allowed = new Set(['outcome', 'action_id']);
    if (!hasExactKeys(values, allowed) || Object.keys(values).length !== allowed.size
        || values.action_id !== capability.actionId
        || values.outcome !== 'confirmed' && values.outcome !== 'rejected') invalidPayload();
    if (values.outcome === 'confirmed' && capability.state !== 'completed')
    {
        throw new InteractionCapabilityError('action_not_completed');
    }
    if (values.outcome === 'rejected' && capability.state !== 'issued') invalidPayload();
};

export const validateCapability = (capability: Capability, values: InteractionValues): void =>
{
    if (capability.kind === 'form') validateForm(capability, values);
    else if (capability.kind === 'choices') validateChoices(capability, values);
    else validateConfirmation(capability, values);
};
