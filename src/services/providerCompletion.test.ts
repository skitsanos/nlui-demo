import {describe, expect, test} from 'bun:test';
import type {ResponseStreamEvent} from 'openai/resources/responses/responses';
import type {ChatStreamEvent, FormBlock} from '../nlui/types.ts';
import {createOpenAIChatRunner, type OpenAIChatDependencies} from './openaiChatRunner.ts';

const event = (value: unknown): ResponseStreamEvent => value as ResponseStreamEvent;
const created = (id = 'response-one') => event({type: 'response.created', response: {id, model: 'test-model'}});
const completed = (id = 'response-one', status = 'completed') => event({
    type: 'response.completed', response: {id, status, model: 'test-model', usage: null}
});
const message = () => event({type: 'response.output_text.delta', delta: JSON.stringify({
    presentation: 'message', answer: 'A safe answer.', caption: null, block_ids: []
})});
const call = () => event({type: 'response.output_item.done', item: {
    type: 'function_call', call_id: 'call-one', name: 'request_details', arguments: '{}'
}});
const form: FormBlock = {
    id: 'form-one', type: 'form', interactionId: 'interaction-one', submitLabel: 'Continue',
    fields: [{input: 'text', name: 'reason', label: 'Reason', required: true}]
};
const blockAnswer = () => event({type: 'response.output_text.delta', delta: JSON.stringify({
    presentation: 'blocks', answer: null, caption: 'Please supply the missing details.', block_ids: [form.id]
})});
const request = {conversationId: 'conversation-provider-check', input: {type: 'user_text' as const, text: 'Help me'}};

const fixture = (rounds: ResponseStreamEvent[][]) =>
{
    const events: ChatStreamEvent[] = [];
    let executions = 0;
    let issuances = 0;
    let providerCalls = 0;
    const dependencies: OpenAIChatDependencies = {
        model: 'test-model',
        createResponse: async () =>
        {
            providerCalls += 1;
            const next = rounds.shift();
            if (!next) throw new Error('No injected provider round remains');
            return (async function* () {for (const item of next) yield item;})();
        },
        executeTool: async () => {executions += 1; return {modelOutput: {ok: true}, blocks: [form]};},
        issueCapabilities: () => {issuances += 1;}
    };
    return {dependencies, events, counts: () => ({executions, issuances, providerCalls})};
};

const noPublishedAnswer = (events: ChatStreamEvent[]): void =>
{
    expect(events.some(({type}) => type === 'text.delta' || type === 'ui.block' || type === 'message.completed')).toBeFalse();
};

describe('provider completion integrity', () =>
{
    test.each([
        [created()],
        [created(), message()],
        [created(), call()]
    ].map((items) => ({items})))('rejects created-only, valid-JSON and tool streams without completion', async ({items}) =>
    {
        const harness = fixture([items]);
        await expect(createOpenAIChatRunner(harness.dependencies)(request,
            (item) => harness.events.push(item), new AbortController().signal)).rejects.toThrow('successful completion');
        expect(harness.counts()).toEqual({executions: 0, issuances: 0, providerCalls: 1});
        noPublishedAnswer(harness.events);
        expect(harness.events.at(-1)).toMatchObject({type: 'activity.updated', activity: {status: 'error'}});
    });

    test.each(['response.failed', 'response.incomplete', 'error', 'cancelled'])('rejects terminal %s without leaking activity diagnostics', async (type) =>
    {
        const terminal = type === 'error' ? event({type, message: 'private diagnostic'})
            : event({type: type === 'cancelled' ? 'response.in_progress' : type,
                response: {id: 'response-one', model: 'test-model', status: type === 'cancelled' ? 'cancelled' : 'failed',
                    error: {message: 'private diagnostic'}, usage: null}});
        const harness = fixture([[created(), call(), terminal]]);
        await expect(createOpenAIChatRunner(harness.dependencies)(request,
            (item) => harness.events.push(item), new AbortController().signal)).rejects.toThrow();
        expect(harness.counts().executions).toBe(0);
        expect(harness.counts().issuances).toBe(0);
        noPublishedAnswer(harness.events);
        const activities = harness.events.filter(({type}) => type === 'activity.updated');
        expect(JSON.stringify(activities)).not.toContain('private diagnostic');
        expect(activities.at(-1)).toMatchObject({activity: {status: type === 'cancelled' ? 'abort' : 'error'}});
    });

    test.each([
        [created(), message(), completed('changed-id')],
        [created(), message(), completed('', 'completed')],
        [created(), message(), completed('response-one', 'failed')],
        [created(), message(), completed('response-one', 'cancelled')],
        [created(), message(), completed(), message()],
        [created(), message(), completed(), completed()]
    ].map((items) => ({items})))('rejects mismatched, non-successful or non-terminal completion events', async ({items}) =>
    {
        const harness = fixture([items]);
        await expect(createOpenAIChatRunner(harness.dependencies)(request,
            (item) => harness.events.push(item), new AbortController().signal)).rejects.toThrow();
        noPublishedAnswer(harness.events);
        expect(harness.counts().issuances).toBe(0);
    });

    test('a truncated final round cannot issue capabilities produced by an earlier completed tool round', async () =>
    {
        const harness = fixture([[created(), call(), completed()], [created('response-two'), blockAnswer()]]);
        await expect(createOpenAIChatRunner(harness.dependencies)(request,
            (item) => harness.events.push(item), new AbortController().signal)).rejects.toThrow('successful completion');
        expect(harness.counts()).toEqual({executions: 1, issuances: 0, providerCalls: 2});
        noPublishedAnswer(harness.events);
        expect(harness.events.at(-1)).toMatchObject({activity: {kind: 'compose', status: 'error'}});
    });

    test('completed tool/structured-output rounds publish exactly one valid answer', async () =>
    {
        const harness = fixture([[created(), call(), completed()],
            [created('response-two'), blockAnswer(), completed('response-two')]]);
        const result = await createOpenAIChatRunner(harness.dependencies)(request,
            (item) => harness.events.push(item), new AbortController().signal);
        expect(result.responseId).toBe('response-two');
        expect(result.blocks).toEqual([form]);
        expect(harness.counts()).toEqual({executions: 1, issuances: 1, providerCalls: 2});
        expect(harness.events.filter(({type}) => type === 'message.completed')).toHaveLength(1);
    });

    test('a completed refusal remains a valid prose response', async () =>
    {
        const harness = fixture([[created(), event({type: 'response.refusal.delta', delta: 'I cannot assist with that.'}), completed()]]);
        const result = await createOpenAIChatRunner(harness.dependencies)(request,
            (item) => harness.events.push(item), new AbortController().signal);
        expect(result.text).toBe('I cannot assist with that.');
        expect(result.blocks).toEqual([]);
        expect(harness.events.at(-1)?.type).toBe('message.completed');
    });

    test('a provider exception after completion does not publish buffered output', async () =>
    {
        const harness = fixture([]);
        harness.dependencies.createResponse = async () => (async function* ()
        {
            yield created(); yield message(); yield completed();
            throw new Error('private disconnect diagnostic');
        })();
        await expect(createOpenAIChatRunner(harness.dependencies)(request,
            (item) => harness.events.push(item), new AbortController().signal)).rejects.toThrow('private disconnect diagnostic');
        noPublishedAnswer(harness.events);
        expect(harness.counts().issuances).toBe(0);
    });
});

describe('cancellation at execution and publication boundaries', () =>
{
    test('an already aborted request never calls the provider', async () =>
    {
        const harness = fixture([]);
        const controller = new AbortController();
        controller.abort();
        await expect(createOpenAIChatRunner(harness.dependencies)(request,
            (item) => harness.events.push(item), controller.signal)).rejects.toThrow();
        expect(harness.counts()).toEqual({executions: 0, issuances: 0, providerCalls: 0});
        noPublishedAnswer(harness.events);
    });

    test('a provider ignoring cancellation cannot succeed after the final event', async () =>
    {
        const harness = fixture([]);
        const controller = new AbortController();
        harness.dependencies.createResponse = async () => (async function* ()
        {
            yield created(); yield message(); yield completed(); controller.abort();
        })();
        await expect(createOpenAIChatRunner(harness.dependencies)(request,
            (item) => harness.events.push(item), controller.signal)).rejects.toThrow();
        noPublishedAnswer(harness.events);
        expect(harness.counts().issuances).toBe(0);
        expect(harness.events.at(-1)).toMatchObject({activity: {status: 'abort'}});
    });

    test.each(['trace', 'tool-start'])('abort at %s prevents tool execution', async (boundary) =>
    {
        const harness = fixture([[created(), call(), completed()]]);
        const controller = new AbortController();
        await expect(createOpenAIChatRunner(harness.dependencies)(request, (item) =>
        {
            harness.events.push(item);
            if (boundary === 'tool-start' && item.type === 'tool.started') controller.abort();
        }, controller.signal, () => {if (boundary === 'trace') controller.abort();})).rejects.toThrow();
        expect(harness.counts().executions).toBe(0);
        expect(harness.counts().issuances).toBe(0);
        noPublishedAnswer(harness.events);
        expect(harness.events.at(-1)).toMatchObject({activity: {status: 'abort'}});
    });

    test('abort during a tool prevents further rounds or capability issuance', async () =>
    {
        const harness = fixture([[created(), call(), completed()]]);
        const controller = new AbortController();
        harness.dependencies.executeTool = async () =>
        {
            controller.abort();
            return {modelOutput: {ok: true}, blocks: [form]};
        };
        await expect(createOpenAIChatRunner(harness.dependencies)(request,
            (item) => harness.events.push(item), controller.signal)).rejects.toThrow();
        expect(harness.counts().providerCalls).toBe(1);
        expect(harness.counts().issuances).toBe(0);
        noPublishedAnswer(harness.events);
        expect(harness.events.at(-1)).toMatchObject({activity: {status: 'abort'}});
    });

    test('abort before composition cannot issue capabilities or publish content', async () =>
    {
        const harness = fixture([[created(), message(), completed()]]);
        const controller = new AbortController();
        await expect(createOpenAIChatRunner(harness.dependencies)(request, (item) =>
        {
            harness.events.push(item);
            if (item.type === 'activity.updated' && item.activity.kind === 'compose') controller.abort();
        }, controller.signal)).rejects.toThrow();
        expect(harness.counts().issuances).toBe(0);
        noPublishedAnswer(harness.events);
        expect(harness.events.at(-1)).toMatchObject({activity: {status: 'abort'}});
    });
});
