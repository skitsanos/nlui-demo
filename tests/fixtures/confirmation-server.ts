import {Database} from 'bun:sqlite';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {RouteContext} from '../../src/core/types.ts';
import {ActionDomainError} from '../../src/data/actionErrors.ts';
import {createDemoRepository} from '../../src/data/index.ts';
import {InteractionCapabilityRegistry} from '../../src/nlui/interactionCapabilities.ts';
import type {ConfirmationBlock} from '../../src/nlui/types.ts';
import {createActionPostHandler} from '../../src/routes/api/actions.ts';
import homepage from './confirmation.html';

// Disposable, non-billable browser fixture. Never discovered by production routing.
const root = await mkdtemp(join(tmpdir(), 'nlui-confirmation-browser-'));
const databasePath = join(root, 'demo.sqlite');
const repository = createDemoRepository({databasePath});
const action = repository.prepareAction({type: 'cancel_order', orderNumber: 'ORD-1176', reason: 'Disposable verification'});
const conversationId = 'confirmation-browser-fixture';
const blocks: ConfirmationBlock[] = [
    {id: 'recover', type: 'confirmation', actionId: action.actionId, title: 'Recover an interrupted response',
        description: 'Cancel synthetic order ORD-1176. The first response is deliberately unreadable after commit.',
        confirmLabel: 'Cancel test order', cancelLabel: 'Keep test order', severity: 'danger', details: [{label: 'Order', value: 'ORD-1176'}]},
    {id: 'reject', type: 'confirmation', actionId: 'rejected-action', title: 'Known domain rejection',
        confirmLabel: 'Try expired action', cancelLabel: 'Dismiss proposal', details: [{label: 'State', value: 'Expired'}]},
    {id: 'unavailable', type: 'confirmation', actionId: 'unavailable-action', title: 'Unverifiable old confirmation',
        confirmLabel: 'Try unavailable action', cancelLabel: 'Dismiss old proposal', details: [{label: 'State', value: 'Will expire before retry'}]},
    {id: 'cancel', type: 'confirmation', actionId: 'cancel-only', title: 'Decline before submission',
        confirmLabel: 'Unused test action', cancelLabel: 'Decline proposal', details: []}
];
const requests = new Map<string, number>();
const continuations = new Map<string, number>();
const handlers = new Map(blocks.map((block) =>
{
    const registry = new InteractionCapabilityRegistry();
    registry.issue(conversationId, block);
    return [block.id, createActionPostHandler({registry, reportError: () => undefined, confirmAction: (id) =>
    {
        if (block.id !== 'recover') throw new ActionDomainError('action_expired');
        const result = repository.confirmAction(id);
        return {modelOutput: result, blocks: [{id: 'recovered-result', type: 'result', status: 'success',
            title: 'Action completed', message: result.message}]};
    }})] as const;
}));
const mutationCount = (): number =>
{
    const database = new Database(databasePath, {readonly: true});
    try {return database.query<{total: number}, [string]>(
        "SELECT COUNT(*) AS total FROM activity_log WHERE json_extract(details_json, '$.actionId') = ?"
    ).get(action.actionId)?.total ?? 0;}
    finally {database.close();}
};
const server = Bun.serve({hostname: '127.0.0.1', port: 0, routes: {'/': homepage}, development: {console: true},
    async fetch(req)
    {
        const path = new URL(req.url).pathname;
        if (path === '/api/fixture') return Response.json(blocks);
        if (path === '/api/actions')
        {
            const {interactionId} = await req.clone().json() as {interactionId: string};
            const attempts = (requests.get(interactionId) ?? 0) + 1;
            requests.set(interactionId, attempts);
            if (interactionId === 'unavailable') return attempts === 1
                ? new Response('Proxy interrupted', {status: 502})
                : Response.json({message: 'This interaction is invalid or no longer available.', outcome: 'unavailable', retryable: false}, {status: 400});
            const response = await handlers.get(interactionId)?.({req} as RouteContext);
            if (interactionId === 'recover' && attempts === 1) return new Response('Proxy interrupted after commit', {status: 502});
            return response ?? new Response(null, {status: 404});
        }
        if (path === '/api/fixture/continue')
        {
            const {interactionId} = await req.json() as {interactionId: string};
            const attempts = (continuations.get(interactionId) ?? 0) + 1;
            continuations.set(interactionId, attempts);
            return Response.json({completed: interactionId !== 'recover' || attempts > 1,
                actionRequests: Object.fromEntries(requests), chatAttempts: Object.fromEntries(continuations), mutations: mutationCount()});
        }
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
process.on('SIGTERM', () => {void close();});
process.on('SIGINT', () => {void close();});
console.log(`FIXTURE_READY ${server.port}`);
