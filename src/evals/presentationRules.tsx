import {renderToStaticMarkup} from 'react-dom/server';
import {NluiRenderer} from '../client/components/NluiRenderer.tsx';
import {type PRODUCT_FACT_KEYS, productFacts} from '../nlui/productFacts.ts';
import {policyCaptions, type ResponsePolicy} from '../nlui/responsePolicy.ts';
import {nluiBlocksSchema} from '../nlui/schemas.ts';
import type {FormBlock, NluiBlock} from '../nlui/types.ts';
import type {DeterministicAssertion} from './assertionSchema.ts';
import {valueAtPath} from './assertionValues.ts';
import {FORM_QUESTION_CRITERIA, PRODUCT_FACT_CRITERIA} from './presentationCriteria.ts';
import type {EvaluationTrace} from './types.ts';

export const renderPresentation = (blocks: NluiBlock[]): string => renderToStaticMarkup(
    <NluiRenderer blocks={blocks} conversationId="presentation-evidence" onInteraction={async () => false}/>
);
const escaped = (value: string): string => renderToStaticMarkup(value);
const failure = 'The application-owned visible presentation contract was not proven';
type Contract = Extract<DeterministicAssertion, {source: 'presentation'}>['contract'];
const specs: Partial<Record<Contract, readonly typeof PRODUCT_FACT_KEYS[number][]>> = {
    travel_specs: ['batteryHours', 'weightKg'], development_specs: ['ramGb', 'storageGb'], monitor_specs: ['resolution']
};

export const evaluatePresentationRule = (
    rule: Extract<DeterministicAssertion, {source: 'presentation'}>, trace: EvaluationTrace
): string | undefined =>
{
    try
    {
        const parsed = nluiBlocksSchema.safeParse(trace.blocks);
        if (!parsed.success) return failure;
        const keys = specs[rule.contract];
        const tools = trace.toolExecutions?.filter((tool) => !tool.rejected && tool.outcome === 'accepted') ?? [];
        if (keys)
        {
            const tool = tools.findLast(({name}) => name === 'search_products');
            const products = valueAtPath(tool?.modelOutput, 'products');
            const choices = parsed.data.filter((block) => block.type === 'choices');
            const options = choices.flatMap(({options}) => options);
            if (!tool || !Array.isArray(products) || !products.length || options.length !== products.length
                || choices.some(({id}) => !tool.candidateBlockIds.includes(id))
                || new Set(options.map(({value}) => value)).size !== options.length) return failure;
            const html = renderPresentation(choices);
            return options.every((option) =>
            {
                const product = products.find((product) => product.sku === option.value);
                if (!product || product.name !== option.label || !product.attributes) return false;
                const actual = option.facts ?? [];
                const expected = productFacts(product.attributes);
                const prefix = `<dl class="product-facts" data-product-sku="${escaped(option.value)}"`;
                const start = html.indexOf(prefix);
                const markup = start < 0 ? '' : html.slice(start, html.indexOf('</dl>', start));
                return actual.every((fact) => expected.some((source) => source.key === fact.key && source.value === fact.value))
                    && keys.every((key) => actual.some((fact) =>
                    {
                        const {label, unit} = PRODUCT_FACT_CRITERIA[key];
                        const value = key === 'resolution' ? String(fact.value).replace('x', ' × ')
                            : `${key === 'weightKg' ? Number(Number(fact.value).toFixed(2)) : fact.value} ${unit}`;
                        return fact.key === key && markup.includes(`data-product-fact="${key}"><dt>${escaped(label)}</dt><dd>${escaped(value)}</dd>`);
                    }));
            }) ? undefined : failure;
        }
        if (rule.contract === 'office_questions' || rule.contract === 'order_questions')
        {
            const kind = rule.contract === 'office_questions' ? 'product_preferences' : 'order_resolution';
            const tool = tools.findLast(({name, arguments: args}) => name === 'request_details' && valueAtPath(args, 'kind') === kind);
            const forms = parsed.data.filter((block) => block.type === 'form');
            const canonical = nluiBlocksSchema.parse([{id: 'criteria', type: 'form', interactionId: 'criteria', submitLabel: 'Continue',
                fields: FORM_QUESTION_CRITERIA[rule.contract]}])[0] as FormBlock;
            if (!tool || forms.length !== 1 || !tool.candidateBlockIds.includes(forms[0]!.id)) return failure;
            const form = forms[0]!;
            const html = renderPresentation([form]);
            return canonical.fields.every((expected) =>
            {
                const {name} = expected;
                const field = form.fields.find((field) => field.name === name);
                const id = escaped(`${form.id}_${name}`);
                return JSON.stringify(field) === JSON.stringify(expected)
                    && html.includes(`for="${id}"`) && html.includes(`id="${id}"`)
                    && html.includes(escaped(expected.label)) && (!expected.help || html.includes(escaped(expected.help)));
            }) ? undefined : failure;
        }
        const policy = rule.contract as ResponsePolicy;
        const tool = tools.findLast(({responsePolicy}) => responsePolicy === policy);
        if (!tool || trace.blocks.some(({type}) => type === 'confirmation' || type === 'form' || type === 'choices')) return failure;
        const evidence = policy === 'delivered_cancellation'
            ? tool.name === 'get_order' && valueAtPath(tool.arguments, 'intent') === 'cancel'
                && valueAtPath(tool.modelOutput, 'order.status') === 'delivered'
            : tool.name === 'search_policies' && valueAtPath(tool.arguments, 'topic') === 'address_after_dispatch'
                && (valueAtPath(tool.modelOutput, 'matches') as Array<{sourcePath: string; section: string}>)?.some((match) =>
                    match.sourcePath === 'knowledge/shipping-policy.md' && match.section === 'Address changes');
        const policies = tools.flatMap(({responsePolicy}) => responsePolicy ? [responsePolicy] : []);
        return evidence && policyCaptions(policies).includes(trace.text) ? undefined : failure;
    }
    catch {return failure;}
};
