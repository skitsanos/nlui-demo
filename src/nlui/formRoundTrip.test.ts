import {describe, expect, test} from 'bun:test';
import {streamChat} from '../client/chat.ts';
import {FormSubmissionController} from '../client/formSubmission.ts';
import type {SocketData} from '../core/types.ts';
import {createChatHandler} from '../routes/api/chat/index.ts';
import {emptyTokenUsage} from '../services/chatTrace.ts';
import {ConversationStateRegistry} from './conversationState.ts';
import {InteractionCapabilityRegistry} from './interactionCapabilities.ts';
import type {InteractionValues} from './interactionCapabilityTypes.ts';
import type {ChatInput, FormBlock} from './types.ts';

const conversationId = 'form-round-trip-test';
const form: FormBlock = {id: 'form-block', type: 'form', interactionId: 'preferences-one', submitLabel: 'Find products',
    fields: [{name: 'purpose', label: 'Purpose', input: 'text', required: true},
        {name: 'budget', label: 'Budget', input: 'number', min: 1, max: 10_000}]};
const fixture = ({failFirst = false, requiredBudget = false} = {}) =>
{
    const issued: FormBlock = {...form, fields: form.fields.map((field) => field.name === 'budget' ? {...field, required: requiredBudget} : field)};
    const capabilities = new InteractionCapabilityRegistry();
    capabilities.issue(conversationId, issued);
    const received: ChatInput[] = [];
    const handler = createChatHandler({capabilities, states: new ConversationStateRegistry(), runChat: async (request, emit) =>
    {
        received.push(request.input);
        if (failFirst && received.length === 1) throw new Error('Private simulated provider interruption');
        emit({type: 'message.completed', messageId: 'form-message', responseId: 'form-response'});
        return {messageId: 'form-message', responseId: 'form-response', model: 'fixture-only', promptVersion: 'fixture',
            text: '', blocks: [], tools: [], rounds: [], usage: emptyTokenUsage(), durationMs: 0};
    }});
    const server = Bun.serve<SocketData>({hostname: '127.0.0.1', port: 0, fetch: async (req, running) =>
        await handler({req, server: running, params: {}, query: {}, pathname: '/api/chat'}) ?? new Response(null, {status: 500})});
    const sent: ChatInput[] = [];
    const submit = async (input: ChatInput): Promise<boolean> =>
    {
        sent.push(input);
        try
        {
            await streamChat({conversationId, input, signal: new AbortController().signal,
                fetchChat: (_url, options) => fetch(`${server.url}api/chat`, options), onEvent: () => undefined});
            return true;
        }
        catch {return false;}
    };
    return {server, issued, received, sent, submit};
};

describe('form client / HTTP / capability round trip', () =>
{
    test('clearing a budget succeeds through the real route, stream consumer and form controller', async () =>
    {
        const setup = fixture();
        try
        {
            const controller = new FormSubmissionController(setup.issued);
            await controller.submit({purpose: 'Design', budget: null}, setup.submit);
            expect(controller.getSnapshot()).toBe('submitted');
            const expected = {type: 'ui_result', interactionId: form.interactionId, values: {purpose: 'Design'}} as const;
            expect(setup.sent).toEqual([expected]);
            expect(setup.received).toEqual([expected]);
            await controller.submit({purpose: 'Design'}, setup.submit);
            expect(setup.sent).toHaveLength(1);
        }
        finally {await setup.server.stop(true);}
    });

    test('the route also canonicalizes raw null from clients that did not normalize it', async () =>
    {
        const setup = fixture();
        try
        {
            expect(await setup.submit({type: 'ui_result', interactionId: form.interactionId, values: {purpose: 'Design', budget: null}})).toBeTrue();
            expect(setup.received[0]).toMatchObject({values: {purpose: 'Design'}});
            expect(setup.received[0]?.type === 'ui_result' && Object.hasOwn(setup.received[0].values, 'budget')).toBeFalse();
        }
        finally {await setup.server.stop(true);}
    });

    test('a failed response releases the form and a corrected retry completes exactly once', async () =>
    {
        const setup = fixture({failFirst: true});
        try
        {
            const controller = new FormSubmissionController(setup.issued);
            await controller.submit({purpose: 'Design', budget: 2000}, setup.submit);
            expect(controller.getSnapshot()).toBe('error');
            await controller.submit({purpose: 'Travel', budget: null}, setup.submit);
            expect(controller.getSnapshot()).toBe('submitted');
            expect(setup.received).toHaveLength(2);
            expect(setup.received[1]).toMatchObject({values: {purpose: 'Travel'}});
            expect(await setup.submit({type: 'ui_result', interactionId: form.interactionId, values: {purpose: 'Replay'}})).toBeFalse();
            expect(setup.received).toHaveLength(2);
        }
        finally {await setup.server.stop(true);}
    });

    test.each<InteractionValues>([{budget: '2000'}, {budget: ''}, {budget: -1}, {extra: null}, {purpose: ''}])(
        'rejects wrong types, ranges, extra fields and missing required text before the runner', async (change) =>
        {
            const setup = fixture();
            try
            {
                expect(await setup.submit({type: 'ui_result', interactionId: form.interactionId,
                    values: {purpose: 'Design', ...change}})).toBeFalse();
                expect(setup.received).toHaveLength(0);
                expect(await setup.submit({type: 'ui_result', interactionId: form.interactionId, values: {purpose: 'Design'}})).toBeTrue();
            }
            finally {await setup.server.stop(true);}
        });

    test('a tampered client descriptor cannot make a server-required number optional', async () =>
    {
        const setup = fixture({requiredBudget: true});
        try
        {
            const controller = new FormSubmissionController(form);
            await controller.submit({purpose: 'Design', budget: null}, setup.submit);
            expect(controller.getSnapshot()).toBe('error');
            expect(setup.received).toHaveLength(0);
            await controller.submit({purpose: 'Design', budget: 2000}, setup.submit);
            expect(controller.getSnapshot()).toBe('submitted');
            expect(setup.received[0]).toMatchObject({values: {purpose: 'Design', budget: 2000}});
        }
        finally {await setup.server.stop(true);}
    });
});
