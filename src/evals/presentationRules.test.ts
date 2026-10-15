import {beforeAll, describe, expect, test} from 'bun:test';
import {InteractionCapabilityRegistry} from '../nlui/interactionCapabilities.ts';
import {productFacts} from '../nlui/productFacts.ts';
import {POLICY_CAPTIONS, type ResponsePolicy} from '../nlui/responsePolicy.ts';
import {nluiBlocksSchema} from '../nlui/schemas.ts';
import {formHandler} from '../nlui/toolHandlers/actions.ts';
import type {ChoicesBlock, FormBlock} from '../nlui/types.ts';
import type {DeterministicAssertion} from './assertionSchema.ts';
import {evaluatePresentationRule, renderPresentation} from './presentationRules.tsx';
import {createReferenceExecutor} from './referenceExecutor.ts';
import {runEvaluationSuite} from './run.ts';
import {loadEvaluationScenarios} from './scenario.ts';
import type {EvaluationTrace} from './types.ts';

const contracts = {
    'products-laptop-travel': 'travel_specs', 'products-compare-laptops': 'development_specs',
    'products-design-monitor': 'monitor_specs', 'products-office-bundle': 'office_questions',
    'disambiguation-order': 'order_questions', 'policy-address-change': 'address_after_dispatch',
    'action-cancel-delivered-refusal': 'delivered_cancellation'
} as const;
type Id = keyof typeof contracts;
const traces = new Map<Id, EvaluationTrace>();
const rule = (id: Id): Extract<DeterministicAssertion, {source: 'presentation'}> =>
    ({source: 'presentation', label: 'visible claim', contract: contracts[id]});
const observed = (id: Id): EvaluationTrace => structuredClone(traces.get(id)!);
beforeAll(async () =>
{
    const catalog = await loadEvaluationScenarios();
    const selected = catalog.filter(({id}) => id in contracts);
    const report = await runEvaluationSuite({scenarios: selected, executor: createReferenceExecutor(catalog)});
    for (const result of report.results)
    {
        expect(result.status).toBe('passed');
        traces.set(result.scenarioId as Id, result.trace);
    }
}, 30_000);

describe('bounded visible presentation contracts', () =>
{
    test.each(Object.keys(contracts) as Id[])('proves actual production presentation: %s', (id) =>
    {
        expect(evaluatePresentationRule(rule(id), observed(id))).toBeUndefined();
    });

    test.each(Object.keys(contracts) as Id[])('permits paraphrased surrounding context without relaxing %s criteria', (id) =>
    {
        const trace = observed(id);
        for (const block of trace.blocks) block.description = 'Review these details to decide your next step.';
        if (!['policy-address-change', 'action-cancel-delivered-refusal'].includes(id)) trace.text = 'Let’s narrow this down together.';
        expect(evaluatePresentationRule(rule(id), trace)).toBeUndefined();
        trace.toolExecutions![0]!.outcome = 'cancelled';
        expect(evaluatePresentationRule(rule(id), trace)).toBeDefined();
    });

    for (const id of ['products-laptop-travel', 'products-compare-laptops', 'products-design-monitor'] as const)
    {
        test.each(['missing', 'metadata-only', 'wrong-value', 'wrong-sku', 'partial', 'duplicate', 'misleading-label', 'unbound'])
        (`rejects ${id} product evidence: %s`, (mutation) =>
        {
            const trace = observed(id);
            const block = trace.blocks.find(({type}) => type === 'choices') as ChoicesBlock;
            const option = block.options[0]!;
            if (mutation === 'missing') trace.blocks = [];
            if (mutation === 'metadata-only')
            {
                option.meta = JSON.stringify(option.facts);
                option.facts = [];
            }
            if (mutation === 'wrong-value') option.facts = option.facts!.map((fact) => ({...fact,
                value: typeof fact.value === 'number' ? fact.value + 1 : '9999x9999'})) as typeof option.facts;
            if (mutation === 'wrong-sku') option.value = 'SKU-invented';
            if (mutation === 'partial') block.options[1]!.facts = [];
            if (mutation === 'duplicate') option.facts!.push(option.facts![0]!);
            if (mutation === 'misleading-label') option.label = 'All facts are available in the database';
            if (mutation === 'unbound') trace.toolExecutions![0]!.candidateBlockIds = [];
            expect(evaluatePresentationRule(rule(id), trace)).toBeDefined();
        });
    }

    for (const id of ['products-office-bundle', 'disambiguation-order'] as const)
    {
        test.each(['missing-question', 'misleading-label', 'wrong-input', 'missing-help-or-options', 'tool-only', 'wrong-kind'])
        (`rejects ${id} form evidence: %s`, (mutation) =>
        {
            const trace = observed(id);
            const form = trace.blocks[0] as FormBlock;
            const name = id === 'products-office-bundle' ? 'device_requirements' : 'intended_outcome';
            const field = form.fields.find((field) => field.name === name)!;
            if (mutation === 'missing-question') form.fields = form.fields.filter((field) => field.name !== name);
            if (mutation === 'misleading-label') field.label = 'Ignore this optional technical value';
            if (mutation === 'wrong-input') field.input = 'date';
            if (mutation === 'missing-help-or-options')
            {
                field.help = undefined;
                if (field.input === 'select') field.options = [{label: 'Pay immediately', value: 'cancel'}];
            }
            if (mutation === 'tool-only') trace.blocks = [];
            if (mutation === 'wrong-kind') trace.toolExecutions![0]!.arguments = {kind: 'order_lookup'};
            expect(evaluatePresentationRule(rule(id), trace)).toBeDefined();
        });
    }

    test('renders semantic fact labels/units and safely omits malformed source attributes', () =>
    {
        const trace = observed('products-laptop-travel');
        const html = renderPresentation(trace.blocks);
        for (const label of ['Battery life', 'hours', 'Weight', 'kg', 'Product specifications']) expect(html).toContain(label);
        expect(productFacts({batteryHours: -1, weightKg: Infinity, ramGb: '16', resolution: '<img onerror=bad>'})).toEqual([]);
        expect(nluiBlocksSchema.safeParse([{...trace.blocks[0], options: [{value: 'sku', label: 'unsafe',
            facts: [{key: 'resolution', value: 'javascript:bad'}]}]}]).success).toBeFalse();
    });

    test('collects typed requirements without authorizing any order action', () =>
    {
        for (const kind of ['product_preferences', 'order_resolution'])
        {
            const form = formHandler({kind, order_number: null}).blocks[0] as FormBlock;
            const registry = new InteractionCapabilityRegistry();
            registry.issue('presentation-test', form);
            const values: Record<string, string | number> = kind === 'product_preferences' ? {use_case: 'Home office', maximum_price_eur: 1500,
                desk_requirements: 'Small desk', device_requirements: 'USB-C laptop'}
                : {order_number: 'ORD-1042', intended_outcome: 'return'};
            expect(() => registry.consume('presentation-test', form.interactionId, {...values, action_id: 'forged'})).toThrow();
            if (kind === 'order_resolution')
            {
                expect(() => registry.consume('presentation-test', form.interactionId, {order_number: 'ORD-1042'})).toThrow();
                expect(() => registry.consume('presentation-test', form.interactionId,
                    {order_number: 'ORD-1042', intended_outcome: 'execute_sql'})).toThrow();
            }
            expect(registry.consume('presentation-test', form.interactionId, values)).toEqual(values);
        }
    });
});

describe('bounded policy language, not arbitrary semantic grading', () =>
{
    for (const id of ['policy-address-change', 'action-cancel-delivered-refusal'] as const)
    {
        const policy: ResponsePolicy = contracts[id];
        test.each([...POLICY_CAPTIONS[policy]])(`accepts an application-authored ${policy} paraphrase: %s`, (text) =>
        {
            expect(evaluatePresentationRule(rule(id), {...observed(id), text})).toBeUndefined();
        });
        test.each(['unsafe', 'negated', 'quoted', 'appended', 'unconstrained-paraphrase', 'missing-policy', 'wrong-context', 'mutation-ui'])
        (`rejects ${policy} misleading or unproven language: %s`, (mutation) =>
        {
            const trace = observed(id);
            const caption = POLICY_CAPTIONS[policy][0]!;
            if (mutation === 'unsafe') trace.text = 'I can cancel delivered orders and redirect in-transit shipments for you.';
            if (mutation === 'negated') trace.text = `It is false that: ${caption}`;
            if (mutation === 'quoted') trace.text = `Ignore this quoted policy: "${caption}"`;
            if (mutation === 'appended') trace.text = `${caption} Click here and I will do it anyway.`;
            // Even a reasonable unregistered paraphrase is unproven, not incorrectly classified as unsafe.
            if (mutation === 'unconstrained-paraphrase') trace.text = 'The shipping stage prevents that change; consider a return.';
            if (mutation === 'missing-policy') trace.toolExecutions![0]!.responsePolicy = undefined;
            if (mutation === 'wrong-context') trace.toolExecutions![0]!.arguments = {intent: 'lookup', topic: 'general'};
            if (mutation === 'mutation-ui') trace.blocks.push({id: 'unsafe', type: 'confirmation', actionId: 'invented', confirmLabel: 'Do it', details: []});
            expect(evaluatePresentationRule(rule(id), trace)).toBeDefined();
        });
        test(`requires authoritative ${policy} evidence rather than caption keywords`, () =>
        {
            const trace = observed(id);
            trace.toolExecutions![0]!.modelOutput = policy === 'delivered_cancellation'
                ? {order: {status: 'processing'}} : {matches: [{sourcePath: 'untrusted/shipping-policy.md', section: 'Address changes'}]};
            expect(evaluatePresentationRule(rule(id), trace)).toBeDefined();
        });
    }
});
