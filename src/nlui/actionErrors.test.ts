import {Database} from 'bun:sqlite';
import {afterEach, describe, expect, test} from 'bun:test';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {RouteContext} from '../core/types.ts';
import {ACTION_ERROR_MESSAGES, ActionDomainError, type ActionErrorCode} from '../data/actionErrors.ts';
import {createDemoRepository} from '../data/index.ts';
import {createActionPostHandler} from '../routes/api/actions.ts';
import {GENERIC_PUBLIC_ACTION_ERROR} from '../services/publicActionError.ts';
import {InteractionCapabilityError, InteractionCapabilityRegistry} from './interactionCapabilities.ts';
import type {ConfirmationBlock} from './types.ts';

const roots: string[] = [];
afterEach(async () => {await Promise.all(roots.splice(0).map((root) => rm(root, {recursive: true, force: true})));});
const confirmation: ConfirmationBlock = {id: 'interaction-one', type: 'confirmation', actionId: 'action-one', confirmLabel: 'Confirm', details: []};
const context = (action = confirmation): RouteContext => ({req: new Request('http://demo.test/api/actions', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({conversationId: 'conversation-one', interactionId: action.id, actionId: action.actionId})
})} as RouteContext);
const registryFor = (action = confirmation): InteractionCapabilityRegistry =>
{
    const registry = new InteractionCapabilityRegistry();
    registry.issue('conversation-one', action);
    return registry;
};

describe('public action error boundary', () =>
{
    test.each([new Error('/private/database.sqlite SELECT payload_json'), new TypeError('provider Authorization: Bearer private-token'),
        'untyped private diagnostic', {message: 'internal object', secret: 'private-token'}])('masks unexpected exceptions and preserves the reservation retry', async (failure) =>
    {
        const registry = registryFor();
        const diagnostics: unknown[] = [];
        const handler = createActionPostHandler({registry, reportError: (error) => diagnostics.push(error),
            confirmAction: () => {throw failure;}});
        for (let attempt = 0; attempt < 2; attempt += 1)
        {
            const response = await handler(context()) as Response;
            expect(response.status).toBe(500);
            expect(await response.json()).toEqual({message: GENERIC_PUBLIC_ACTION_ERROR, outcome: 'unknown', retryable: true});
        }
        expect(diagnostics).toEqual([failure, failure]);
    });

    test.each(Object.keys(ACTION_ERROR_MESSAGES) as ActionErrorCode[])('uses the fixed public message for domain code %s', async (code) =>
    {
        const failure = new ActionDomainError(code);
        failure.message = '/private/path and provider diagnostic';
        let reports = 0;
        const handler = createActionPostHandler({registry: registryFor(), reportError: () => {reports += 1;},
            confirmAction: () => {throw failure;}});
        const response = await handler(context()) as Response;
        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({message: ACTION_ERROR_MESSAGES[code], outcome: 'rejected', retryable: false});
        expect(reports).toBe(0);
    });

    test('forged error names and broken diagnostic sinks cannot bypass sanitization', async () =>
    {
        const failure = new Error('private diagnostic');
        failure.name = 'ActionDomainError';
        const response = await createActionPostHandler({registry: registryFor(),
            confirmAction: () => {throw failure;}, reportError: () => {throw new Error('logging failed');}})(context()) as Response;
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({message: GENERIC_PUBLIC_ACTION_ERROR, outcome: 'unknown', retryable: true});
    });

    test('a capability failure keeps a fixed safe 400 message', async () =>
    {
        const registry = registryFor();
        registry.beginConfirmation = () =>
        {
            const failure = new InteractionCapabilityError('unknown');
            failure.message = 'private diagnostic';
            throw failure;
        };
        const response = await createActionPostHandler({registry, confirmAction: () => {throw new Error('must not execute');}})(context()) as Response;
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({message: 'This interaction is invalid or no longer available.', outcome: 'unavailable', retryable: false});
    });

    test('a failure after durable mutation can retry without executing the mutation twice', async () =>
    {
        const root = await mkdtemp(join(tmpdir(), 'nlui-action-error-test-'));
        roots.push(root);
        const databasePath = join(root, 'demo.sqlite');
        const repository = createDemoRepository({databasePath});
        try
        {
            const prepared = repository.prepareAction({type: 'cancel_order', orderNumber: 'ORD-1176', reason: 'Duplicate request'});
            const action = {...confirmation, actionId: prepared.actionId};
            let attempts = 0;
            const handler = createActionPostHandler({registry: registryFor(action), reportError: () => undefined,
                confirmAction: (id) =>
                {
                    const result = repository.confirmAction(id);
                    attempts += 1;
                    if (attempts === 1) throw new Error('Private failure after commit');
                    return {modelOutput: result, blocks: [{id: 'result-one', type: 'result', status: 'success', message: result.message}]};
                }});
            expect((await handler(context(action)))?.status).toBe(500);
            expect((await handler(context(action)))?.status).toBe(200);
            const replay = await handler(context(action)) as Response;
            expect(await replay.json()).toMatchObject({replayed: true});
            expect(attempts).toBe(2);
            expect(repository.getOrder('ORD-1176')?.status).toBe('cancelled');
            const database = new Database(databasePath, {readonly: true});
            try
            {
                expect(database.query<{total: number}, [string]>(
                    "SELECT COUNT(*) AS total FROM activity_log WHERE json_extract(details_json, '$.actionId') = ?"
                ).get(prepared.actionId)?.total).toBe(1);
            }
            finally {database.close();}
        }
        finally {repository.close();}
    });
});
