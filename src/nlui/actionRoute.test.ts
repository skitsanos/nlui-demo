import {describe, expect, test} from 'bun:test';
import type {RouteContext} from '../core/types.ts';
import {createActionPostHandler} from '../routes/api/actions.ts';
import {InteractionCapabilityRegistry} from './interactionCapabilities.ts';
import type {ConfirmationBlock} from './types.ts';

const confirmation: ConfirmationBlock = {
    id: 'interaction-1',
    type: 'confirmation',
    actionId: 'action-1',
    confirmLabel: 'Confirm',
    details: []
};

const request = (conversationId = 'conversation-primary'): Request => new Request('http://demo.test/api/actions', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({conversationId, interactionId: confirmation.id, actionId: confirmation.actionId})
});

const context = (req: Request): RouteContext => ({req} as RouteContext);

describe('action capability route', () =>
{
    test('executes once and returns its cached result on a retry', async () =>
    {
        const registry = new InteractionCapabilityRegistry();
        registry.issue('conversation-primary', confirmation);
        let executions = 0;
        const handler = createActionPostHandler({
            registry,
            confirmAction: () =>
            {
                executions += 1;
                return {
                    modelOutput: {ok: true},
                    blocks: [{id: 'result-1', type: 'result', status: 'success', message: 'Completed once'}]
                };
            }
        });

        const first = await handler(context(request()));
        const retry = await handler(context(request()));
        expect(first?.status).toBe(200);
        expect(retry?.status).toBe(200);
        expect(await retry?.json()).toMatchObject({replayed: true, block: {message: 'Completed once'}});
        expect(executions).toBe(1);
    });

    test('rejects a cross-conversation confirmation before execution', async () =>
    {
        const registry = new InteractionCapabilityRegistry();
        registry.issue('conversation-primary', confirmation);
        let executions = 0;
        const handler = createActionPostHandler({
            registry,
            confirmAction: () =>
            {
                executions += 1;
                return {modelOutput: {}, blocks: []};
            }
        });

        const response = await handler(context(request('conversation-attacker')));
        expect(response?.status).toBe(400);
        expect(executions).toBe(0);
    });
});
