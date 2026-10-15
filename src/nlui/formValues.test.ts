import {describe, expect, test} from 'bun:test';
import {normalizeFormValues} from './formValues.ts';
import {InteractionCapabilityRegistry} from './interactionCapabilities.ts';
import {fieldRule, type InteractionValues} from './interactionCapabilityTypes.ts';
import type {FormBlock} from './types.ts';

const form: FormBlock = {id: 'form-block', type: 'form', interactionId: 'form-inputs', submitLabel: 'Continue', fields: [
    {name: 'budget', label: 'Budget', input: 'number', min: 0, max: 10_000},
    {name: 'quantity', label: 'Quantity', input: 'number', required: true, min: 1, max: 10},
    {name: 'purpose', label: 'Purpose', input: 'text', required: true},
    {name: 'notes', label: 'Notes', input: 'text'},
    {name: 'tier', label: 'Tier', input: 'select', options: [{value: 'gold', label: 'Gold'}]},
    {name: 'date', label: 'Date', input: 'date'}
]};
const fields = new Map(form.fields.map((field) => [field.name, fieldRule(field)]));
const registry = () =>
{
    const capabilities = new InteractionCapabilityRegistry();
    capabilities.issue('form-conversation', form);
    return capabilities;
};
const valid: InteractionValues = {purpose: 'Design', quantity: 1};

describe('issued form value normalization', () =>
{
    test.each([null, undefined])('omits only empty optional numbers without mutating the original payload', (budget) =>
    {
        const input = Object.freeze({...valid, budget, notes: ''});
        expect(normalizeFormValues(fields, input)).toEqual({...valid, notes: ''});
        expect(Object.hasOwn(input, 'budget')).toBeTrue();
    });

    test.each([0, 1, 10_000])('preserves exact optional numeric value %s', (budget) =>
    {
        expect(normalizeFormValues(fields, {...valid, budget})).toEqual({...valid, budget});
    });

    test('server consumes a cleared optional number as omission', () =>
    {
        expect(registry().consume('form-conversation', form.interactionId, {...valid, budget: null})).toEqual(valid);
    });

    test.each([
        {quantity: null}, {quantity: undefined}, {quantity: '2'}, {quantity: 0}, {quantity: 11},
        {budget: ''}, {budget: '100'}, {budget: false}, {budget: []}, {budget: -1}, {budget: 10_001},
        {budget: Number.NaN}, {budget: Number.POSITIVE_INFINITY}, {notes: null}, {tier: null}, {date: null},
        {purpose: ''}, {purpose: '   '}, {extra: null}
    ])('normalization does not weaken required/type/range/unknown-field checks', (change) =>
    {
        const capabilities = registry();
        // Includes runtime-invalid values a typed caller would not normally construct.
        expect(() => capabilities.consume('form-conversation', form.interactionId, {...valid, ...change} as unknown as InteractionValues)).toThrow();
        // Invalid attempts do not consume the usable form capability.
        expect(capabilities.consume('form-conversation', form.interactionId, valid)).toEqual(valid);
    });

    test('unknown and prototype-shaped keys are preserved for rejection, not silently discarded', () =>
    {
        const input = JSON.parse('{"purpose":"Design","quantity":1,"__proto__":null,"budget":null}') as InteractionValues;
        const normalized = normalizeFormValues(fields, input);
        expect(Object.hasOwn(normalized, '__proto__')).toBeTrue();
        expect(Object.hasOwn(normalized, 'budget')).toBeFalse();
        expect(() => registry().consume('form-conversation', form.interactionId, input)).toThrow();
    });

    test('undefined issued fields use JSON omission but unknown keys remain rejectable', () =>
    {
        expect(normalizeFormValues(fields, {...valid, notes: undefined, extra: undefined})).toEqual({...valid, extra: null});
    });

    test('normalization cannot bypass conversation, expiry or replay constraints', () =>
    {
        const capabilities = registry();
        expect(() => capabilities.consume('other-conversation', form.interactionId, {...valid, budget: null})).toThrow();
        capabilities.consume('form-conversation', form.interactionId, {...valid, budget: null});
        expect(() => capabilities.consume('form-conversation', form.interactionId, {...valid, budget: null})).toThrow();
        let now = 0;
        const expired = new InteractionCapabilityRegistry({ttlMs: 10, now: () => now});
        expired.issue('form-conversation', form);
        now = 10;
        expect(() => expired.consume('form-conversation', form.interactionId, {...valid, budget: null})).toThrow();
    });
});
