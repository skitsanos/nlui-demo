import {createHash} from 'node:crypto';
import {z} from 'zod';
import {DATASET_REFERENCE_DATE} from '../../data/constants.ts';
import {REGIONS} from '../toolArguments.ts';
import {getRepository, normalizeOrderNumber} from '../toolRuntime.ts';
import type {ToolContext, ToolExecution} from '../toolTypes.ts';
import {type InfographicBlock, infographicBlockSchema } from './schema.ts';

const argsSchema = z.object({
    view: z.enum(['comparison', 'timeline', 'process']), regions: z.array(z.enum(REGIONS)).max(2),
    from: z.iso.date().nullable(), to: z.iso.date().nullable(), order_number: z.string().max(40).nullable()
}).strict();
const fingerprint = (data: unknown): string => createHash('sha256').update(JSON.stringify(data)).digest('hex');

const finish = (value: Omit<InfographicBlock, 'id' | 'type' | 'snapshot'>): ToolExecution =>
{
    const block = infographicBlockSchema.parse({...value, id: crypto.randomUUID(), type: 'infographic', snapshot: DATASET_REFERENCE_DATE});
    // Zod normalizes item property order. Fingerprint the issued descriptor, not its pre-validation input.
    block.provenance.fingerprint = fingerprint({scope: block.provenance.scope, items: block.items});
    return {blocks: [block], modelOutput: {ok: true, renderedAs: 'infographic', view: block.view,
        scope: block.provenance.scope, source: block.provenance.source, itemCount: block.items.length,
        dataLocation: 'trusted_ui_block', warnings: block.description}, traceOutput: {fingerprint: block.provenance.fingerprint}};
};

export const infographicHandler = (raw: unknown, context?: ToolContext): ToolExecution =>
{
    const args = argsSchema.parse(raw); const repository = getRepository(context);
    if (args.view === 'comparison')
    {
        if (args.regions.length !== 2 || new Set(args.regions).size !== 2 || !args.from || !args.to || args.order_number !== null
            || args.from > args.to || args.to > DATASET_REFERENCE_DATE.slice(0, 10))
            throw new Error('Choose two distinct regions and an explicit observed date range for a comparison.');
        const snapshot = repository.getDashboard({from: args.from, to: args.to});
        const items = args.regions.map((label) => ({label, detail: 'Eligible order revenue · EUR',
            value: Number(((snapshot.salesByRegion.find((point) => point.region === label)?.revenueCents ?? 0) / 100).toFixed(2))}));
        const scope = `${args.from} to ${args.to} inclusive; two selected regions; EUR; order creation date; cancelled and returned orders excluded.`;
        return finish({view: 'comparison', title: `${args.regions[0]} and ${args.regions[1]} revenue`, items,
            description: 'An exact side-by-side comparison, not an explanation of why the regions differ.',
            provenance: {source: 'dataset:regional-revenue', fingerprint: fingerprint({scope, items}), scope}});
    }
    if (args.regions.length || args.from !== null || args.to !== null) throw new Error('Only comparisons accept regions and dates.');
    if (args.view === 'timeline')
    {
        if (!args.order_number || !/^(?:ORD-)?\d+$/i.test(args.order_number.trim())) throw new Error('Choose one order number for its recorded history.');
        const order = repository.getOrder(normalizeOrderNumber(args.order_number));
        if (!order) return {modelOutput: {ok: false, error: 'That order was not found.'}, blocks: []};
        const events: Array<{label: string; at: string | null | undefined; detail: string}> = [
            {label: 'Order created', at: order.createdAt, detail: 'Recorded order creation'},
            {label: 'Payment recorded', at: order.payment?.paidAt, detail: 'Recorded payment timestamp'},
            {label: 'Dispatched', at: order.shipment?.shippedAt, detail: 'Recorded shipment dispatch'},
            {label: 'Delivered', at: order.shipment?.deliveredAt, detail: 'Recorded shipment delivery'},
            ...order.returns.map((entry) => ({label: `Return requested ${entry.returnNumber}`, at: entry.requestedAt,
                detail: 'A request was recorded; this timestamp is not refund completion'}))
        ];
        const items = events.filter((event): event is {label: string; at: string; detail: string} =>
            Boolean(event.at) && Number.isFinite(Date.parse(event.at!)) && Date.parse(event.at!) <= Date.parse(DATASET_REFERENCE_DATE))
            .sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).map(({label, at, detail}) => ({label, at: new Date(at).toISOString(), detail}));
        if (!items.length || items.length > 10) throw new Error('This history exceeds the bounded timeline; use the order details instead.');
        const scope = `${order.orderNumber}; observed events through the dataset snapshot; UTC; expected dates and unrecorded milestones omitted.`;
        return finish({view: 'timeline', title: `${order.orderNumber} recorded history`, items,
            description: 'Only recorded events are shown. Missing milestones are unknown. Spacing shows sequence, not elapsed time.',
            provenance: {source: 'dataset:order-events', fingerprint: fingerprint({scope, items}), scope}});
    }
    if (args.order_number !== null) throw new Error('The general return process does not accept an order or decide eligibility.');
    const matches = repository.getPolicySections('knowledge/returns-policy.md');
    // Exact full sections, in application-owned pedagogical order; never truncate away policy conditions.
    const sections = [
        ['Check the return window', 'Standard return window'], ['Check exclusions', 'Non-returnable items'],
        ['Report damage if applicable', 'Damaged or incorrect items'], ['Inspection and refund', 'Refund timing and amount']
    ];
    const items = sections.map(([label, section]) => {
        const match = matches.find((entry) => entry.section === section);
        if (!match) throw new Error('The required return-policy sections are unavailable; use policy search.');
        return {label: label!, detail: match.text};
    });
    const scope = 'General return policy; conditional guidance only; no order eligibility decision, authorized action or refund guarantee.';
    return finish({view: 'process', title: 'How returns work', items,
        description: 'This explains the policy, not the status or eligibility of a particular order. Nothing is submitted.',
        provenance: {source: 'knowledge/returns-policy.md', fingerprint: fingerprint({scope, items}), scope}});
};
