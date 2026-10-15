import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {SocketData} from '../../src/core/types.ts';
import {createDemoRepository} from '../../src/data/index.ts';
import {ConversationStateRegistry} from '../../src/nlui/conversationState.ts';
import {InteractionCapabilityRegistry} from '../../src/nlui/interactionCapabilities.ts';
import {formHandler} from '../../src/nlui/toolHandlers/actions.ts';
import type {ChatInput, FormBlock, StatsBlock} from '../../src/nlui/types.ts';
import {createChatHandler} from '../../src/routes/api/chat/index.ts';
import {emptyTokenUsage} from '../../src/services/chatTrace.ts';
import {abortable} from '../../src/utils/abort.ts';
import homepage from './controls.html';

// Non-billable fixture only. Real controls and the chat route; no production-discovered test endpoint.
const root = await mkdtemp(join(tmpdir(), 'nlui-controls-browser-'));
const repository = createDemoRepository({databasePath: join(root, 'demo.sqlite')});
const product = repository.searchProducts({skus: ['SKU-0001'], limit: 1})[0]!;
const order = repository.getOrder('ORD-1176')!;
const statistics: StatsBlock[] = [
    {id: 'fixture-product', type: 'stats', title: product.name, description: product.description, items: [
        {label: 'Price', value: product.priceCents / 100, format: 'currency'}, {label: 'Rating', value: `${product.rating.toFixed(1)} / 5`},
        {label: 'In stock', value: product.stockQuantity}, {label: 'Category', value: product.category}
    ]},
    {id: 'fixture-order', type: 'stats', title: order.orderNumber, description: `Order for ${order.customerName} in ${order.region}.`, items: [
        {label: 'Status', value: order.status, format: 'status'}, {label: 'Total', value: order.totalCents / 100, format: 'currency'},
        {label: 'Items', value: order.itemCount}, {label: 'Region', value: order.region}
    ]}
];
const forms = ['success', 'retry'].map((kind): FormBlock =>
{
    const block = formHandler({kind: 'product_preferences', order_number: null}).blocks[0] as FormBlock;
    return {...block, id: `form-${kind}`, interactionId: `preferences-${kind}`,
        title: kind === 'success' ? 'Successful submission' : 'Retry after interruption',
        description: kind === 'success' ? 'Clear the optional budget and submit once.' : 'The first response deliberately fails; edit and retry.',
        initialValues: {use_case: 'Design', maximum_price_eur: 2500, preferences: 'Lightweight'}};
});
const capabilities = new InteractionCapabilityRegistry();
for (const form of forms) capabilities.issue(`controls-${form.interactionId}`, form);
const attempts = new Map<string, number>();
const received: ChatInput[] = [];
const pending = new Set<() => void>();
const handler = createChatHandler({capabilities, states: new ConversationStateRegistry(), runChat: async (request, emit, signal) =>
{
    if (request.input.type !== 'ui_result') throw new Error('Fixture accepts form results only');
    received.push(request.input);
    const id = request.input.interactionId;
    const attempt = (attempts.get(id) ?? 0) + 1;
    attempts.set(id, attempt);
    emit({type: 'message.started', messageId: `${id}-${attempt}`});
    let release: () => void;
    const held = new Promise<void>((resolve) => {release = resolve;});
    pending.add(release!);
    try {await abortable(() => held, signal);}
    finally {pending.delete(release!);}
    if (id === 'preferences-retry' && attempt === 1) throw new Error('Private simulated fixture interruption');
    const responseId = `fixture-${id}-${attempt}`;
    emit({type: 'message.completed', messageId: `${id}-${attempt}`, responseId});
    return {messageId: `${id}-${attempt}`, responseId, model: 'fixture-only', promptVersion: 'fixture', text: '', blocks: [],
        tools: [], rounds: [], usage: emptyTokenUsage(), durationMs: 0};
}});
const server = Bun.serve<SocketData>({hostname: '127.0.0.1', port: 0, routes: {'/': homepage}, development: {console: true},
    async fetch(req, running)
    {
        const pathname = new URL(req.url).pathname;
        if (pathname === '/api/fixture') return Response.json({forms, statistics});
        if (pathname === '/api/fixture/state') return Response.json({attempts: Object.fromEntries(attempts), received, pending: pending.size});
        if (pathname === '/api/fixture/release' && req.method === 'POST')
        {
            for (const release of pending) release();
            return Response.json({released: pending.size});
        }
        if (pathname === '/api/chat') return await handler({req, server: running, params: {}, query: {}, pathname}) ?? new Response(null, {status: 500});
        return new Response(null, {status: 404});
    }
});
let closing = false;
const close = async () =>
{
    if (closing) return;
    closing = true;
    await server.stop(true);
    repository.close();
    await rm(root, {recursive: true, force: true});
    process.exit(0);
};
process.on('SIGINT', () => {void close();});
process.on('SIGTERM', () => {void close();});
console.log(`FIXTURE_READY ${server.port}`);
