import {Database} from 'bun:sqlite';
import {describe, expect, test} from 'bun:test';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ConfirmationController} from '../client/confirmationController.ts';
import {requestConfirmation} from '../client/confirmationRequest.ts';
import type {RouteContext} from '../core/types.ts';
import {createDemoRepository} from '../data/index.ts';
import {createActionPostHandler} from '../routes/api/actions.ts';
import {BUSY_ACTION_MESSAGE} from './actionResponse.ts';
import {InteractionCapabilityRegistry} from './interactionCapabilities.ts';

describe('confirmation reconciliation over real HTTP and SQLite', () =>
{
    test.each(['dropped-response', 'post-commit-error', 'pre-request-disconnect'])(
        '%s recovers with the same capability and exactly one durable mutation', async (failure) =>
        {
            const root = await mkdtemp(join(tmpdir(), 'nlui-confirmation-recovery-'));
            const databasePath = join(root, 'demo.sqlite');
            const repository = createDemoRepository({databasePath});
            const registry = new InteractionCapabilityRegistry();
            const prepared = repository.prepareAction({type: 'cancel_order', orderNumber: 'ORD-1176', reason: 'Duplicate request'});
            const identity = {conversationId: 'confirmation-http-test', interactionId: 'confirmation-one', actionId: prepared.actionId};
            registry.issue(identity.conversationId, {id: identity.interactionId, type: 'confirmation',
                actionId: identity.actionId, confirmLabel: 'Confirm', details: []});
            let executions = 0;
            const handler = createActionPostHandler({registry, reportError: () => undefined, confirmAction: (id) =>
            {
                const result = repository.confirmAction(id);
                executions += 1;
                if (failure === 'post-commit-error' && executions === 1) throw new Error('Private failure after commit');
                return {modelOutput: result, blocks: [{id: 'completed-once', type: 'result', status: 'success', message: result.message}]};
            }});
            const server = Bun.serve({hostname: '127.0.0.1', port: 0,
                fetch: async (req) => await handler({req} as RouteContext) ?? new Response(null, {status: 500})});
            const requests: string[] = [];
            let chats = 0;
            const controller = new ConfirmationController(identity, (ids, signal) => requestConfirmation(ids, signal, {
                fetchAction: async (_url, options) =>
                {
                    requests.push(options.body as string);
                    if (failure === 'pre-request-disconnect' && requests.length === 1) throw new Error('offline');
                    const response = await fetch(`${server.url}api/actions`, options);
                    if (failure === 'dropped-response' && requests.length === 1)
                    {await response.arrayBuffer(); throw new Error('Response lost after commit');}
                    return response;
                }
            }));
            try
            {
                await controller.confirm(async () => {chats += 1; return true;});
                expect(controller.getSnapshot()).toMatchObject({phase: 'uncertain', retryable: true});
                expect(chats).toBe(0);
                await controller.confirm(async (input) =>
                {
                    expect(input.type).toBe('ui_result');
                    if (input.type === 'ui_result')
                        expect(registry.consume(identity.conversationId, input.interactionId, input.values)).toMatchObject({action_status: 'success'});
                    chats += 1;
                    return true;
                });
                expect(controller.getSnapshot()).toMatchObject({phase: 'completed', recovered: true});
                expect(requests).toEqual([JSON.stringify(identity), JSON.stringify(identity)]);
                const replay = await fetch(`${server.url}api/actions`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: requests[0]});
                expect(await replay.json()).toMatchObject({replayed: true});
                expect(chats).toBe(1);
                expect(executions).toBe(failure === 'post-commit-error' ? 2 : 1);
                const database = new Database(databasePath, {readonly: true});
                try
                {
                    expect(database.query<{total: number}, [string]>(
                        "SELECT COUNT(*) AS total FROM activity_log WHERE json_extract(details_json, '$.actionId') = ?"
                    ).get(prepared.actionId)?.total).toBe(1);
                }
                finally {database.close();}
            }
            finally {await server.stop(true); repository.close(); await rm(root, {recursive: true, force: true});}
        });

    test('an already executing capability is uncertain/retryable without executing another action', async () =>
    {
        const registry = new InteractionCapabilityRegistry();
        registry.issue('confirmation-busy', {id: 'busy-one', type: 'confirmation', actionId: 'action-one', confirmLabel: 'Confirm', details: []});
        registry.beginConfirmation('confirmation-busy', 'busy-one', 'action-one');
        let calls = 0;
        const response = await createActionPostHandler({registry, confirmAction: () => {calls += 1; return {modelOutput: {}, blocks: []};}})({
            req: new Request('http://demo.test/api/actions', {method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({conversationId: 'confirmation-busy', interactionId: 'busy-one', actionId: 'action-one'})})
        } as RouteContext) as Response;
        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({message: BUSY_ACTION_MESSAGE, outcome: 'unknown', retryable: true});
        expect(calls).toBe(0);
    });

    test('a non-success completion block is not a trustworthy recorded action result', async () =>
    {
        const registry = new InteractionCapabilityRegistry();
        registry.issue('confirmation-invalid', {id: 'invalid-one', type: 'confirmation', actionId: 'action-one', confirmLabel: 'Confirm', details: []});
        const response = await createActionPostHandler({registry, reportError: () => undefined, confirmAction: () => ({modelOutput: {},
            blocks: [{id: 'invalid-result', type: 'result', status: 'error', message: 'Private failure'}]})})({req: new Request('http://demo.test/api/actions', {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({conversationId: 'confirmation-invalid',
                interactionId: 'invalid-one', actionId: 'action-one'})})} as RouteContext) as Response;
        expect(response.status).toBe(500);
        expect(await response.json()).toMatchObject({outcome: 'unknown', retryable: true});
        expect(registry.beginConfirmation('confirmation-invalid', 'invalid-one', 'action-one')).toEqual({status: 'execute'});
    });
});
