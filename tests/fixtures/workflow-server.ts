import {Database} from 'bun:sqlite';
import {cp, mkdir, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import homepage from '../../src/client/index.html';
import type {RouteHandler, SocketData} from '../../src/core/types.ts';

// Actual App, HTTP routes, fixture DB and durable state; never a provider call.
const project = resolve(import.meta.dir, '../..');
const root = await mkdtemp(join(tmpdir(), 'nlui-workflow-browser-'));
await mkdir(join(root, 'data')); await cp(join(project, 'data/knowledge'), join(root, 'data/knowledge'), {recursive: true});
process.chdir(root);
const {createDemoRepository} = await import('../../src/data/index.ts');
const {getConversationStore} = await import('../../src/conversations/store.ts');
const {createOwnedChatHandler} = await import('../../src/conversations/chat.ts');
const {actionIntentFor} = await import('../../src/conversations/history.ts');
const {interactionCapabilities} = await import('../../src/nlui/interactionCapabilities.ts');
const {executeNluiTool} = await import('../../src/nlui/tools.ts');
const {emptyTokenUsage} = await import('../../src/services/chatTrace.ts');
const conversations = await import('../../src/routes/api/conversations.ts');
const analysis = await import('../../src/routes/api/analysis.ts');
const actions = await import('../../src/routes/api/actions.ts');
const datasets = await import('../../src/routes/api/datasets/preview.ts');
const catalog = await import('../../src/routes/api/catalog.ts');
const store = getConversationStore(); const repository = createDemoRepository();
const data = {databasePath: join(root, 'data/demo.sqlite'), repository};
const observedDatabase = new Database(data.databasePath, {readonly: true});
let toolCalls = 0;
const chat = createOwnedChatHandler({store, registry: interactionCapabilities, run: async (request, emit, signal) =>
{
    signal.throwIfAborted();
    const messageId = crypto.randomUUID(); emit({type: 'message.started', messageId});
    const text = request.input.type === 'user_text' ? request.input.text.toLowerCase() : '';
    if (text.includes('interrupt fixture')) await new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), {once: true}));
    let name = 'query_dataset';
    let args: Record<string, unknown> = {sql: 'SELECT COUNT(*) AS customer_count FROM customers', title: 'Registered customers', presentation: 'metric'};
    let caption = 'Here’s the customer population in the synthetic snapshot.';
    if (text.includes('sales') || text.includes('trend'))
    {
        name = 'get_dashboard'; args = {from: '2026-01-01', to: '2026-06-30', region: null, group_by: 'month'};
        caption = 'Here’s the six-month view. Compare the monthly pattern with the headline metrics before drilling into a region.';
    }
    else if (text.includes('delayed'))
    {
        name = 'list_orders'; args = {search: null, statuses: ['delayed'], region: null, minimum_total_eur: 500,
            maximum_total_eur: null, from: null, to: null, sort: 'total_desc', limit: 25};
        caption = 'These delayed orders are ranked by value so you can review the highest-impact cases first.';
    }
    else if (text.includes('laptop') || text.includes('design'))
    {
        name = 'search_products'; args = {query: null, category: 'Laptops', brands: [], skus: [], minimum_price_eur: null,
            maximum_price_eur: null, minimum_rating: null, minimum_stock: null, maximum_stock: null, in_stock_only: true,
            preferences: [], attribute_filters: [], limit: 3}; caption = 'Here are three in-stock options. Select one to continue the comparison.';
    }
    else if (text.includes('return'))
    {
        name = 'request_details'; args = {kind: 'return_request', order_number: null}; caption = 'Let’s check the order and reason first. Nothing changes until you review and confirm a proposal.';
    }
    else if (request.input.type === 'ui_result')
    {
        if (request.input.values.outcome || request.input.values.selection)
        {
            emit({type: 'text.delta', delta: 'Thanks — your verified choice is recorded. No additional action has been authorized.'});
            emit({type: 'message.completed', messageId, responseId: 'fixture-provider-id'});
            return {messageId, responseId: 'fixture-provider-id', model: 'fixture', promptVersion: 'fixture', text: '', blocks: [], tools: [], rounds: [], usage: emptyTokenUsage(), durationMs: 0};
        }
        name = 'prepare_action'; args = {action_type: 'return_order', order_number: request.input.values.order_number,
            reason: request.input.values.reason, address: null}; caption = 'Review this proposed return carefully. It will run only after your confirmation.';
    }
    const owner = store.database.query<{owner: string}, [string]>('SELECT owner FROM conversations WHERE id=?').get(request.conversationId)!.owner;
    const execution = await executeNluiTool(name, JSON.stringify(args), signal, data, {ownerScope: `${owner}:${request.conversationId}`, actionIntent: actionIntentFor(request.input)});
    toolCalls++; interactionCapabilities.issueMany(request.conversationId, execution.blocks);
    emit({type: 'text.delta', delta: caption});
    for (const block of execution.blocks) emit({type: 'ui.block', block});
    emit({type: 'message.completed', messageId, responseId: 'fixture-provider-id'});
    return {messageId, responseId: 'fixture-provider-id', model: 'fixture', promptVersion: 'fixture', text: caption,
        blocks: execution.blocks, tools: [], rounds: [], usage: emptyTokenUsage(), durationMs: 0};
}});
const routes: Record<string, Partial<Record<string, RouteHandler>>> = {
    '/api/chat': {POST: chat}, '/api/conversations': {GET: conversations.GET}, '/api/analysis': {GET: analysis.GET, POST: analysis.POST},
    '/api/actions': {POST: actions.POST}, '/api/datasets/preview': {GET: datasets.GET, POST: datasets.POST}, '/api/catalog': {GET: catalog.GET}
};
const server = Bun.serve<SocketData>({hostname: '127.0.0.1', port: 0, routes: {'/': homepage}, development: {console: true},
    async fetch(req, server)
    {
        const pathname = new URL(req.url).pathname;
        if (pathname === '/api/config') return Response.json({chat: {configured: true}});
        if (pathname === '/api/fixture/state') return Response.json({toolCalls, mutationCount: observedDatabase.query<{n: number}, []>('SELECT COUNT(*) n FROM activity_log').get()!.n});
        const handler = routes[pathname]?.[req.method];
        return handler ? await handler({req, server, pathname, params: {}, query: {}}) ?? new Response(null, {status: 500}) : new Response(null, {status: 404});
    }});
let closing = false;
const close = async () =>
{
    if (closing) return; closing = true; await server.stop(true); repository.close(); observedDatabase.close(); store.close();
    await rm(root, {recursive: true, force: true}); process.exit(0);
};
process.on('SIGINT', () => {void close();}); process.on('SIGTERM', () => {void close();});
console.log(`FIXTURE_READY ${server.port}`);
