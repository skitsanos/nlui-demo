import {describe, expect, test} from 'bun:test';
import type {ResponseStreamEvent} from 'openai/resources/responses/responses';
import type {ToolExecution} from '../nlui/tools.ts';
import type {ChatActivity, ChatStreamEvent} from '../nlui/types.ts';
import {createOpenAIChatRunner, type OpenAIChatDependencies} from './openaiChatRunner.ts';

const event = (value: unknown): ResponseStreamEvent => value as ResponseStreamEvent;

const responseCreated = (id: string): ResponseStreamEvent => event({
    type: 'response.created',
    response: {id, model: 'test-model'}
});

const responseCompleted = (id: string): ResponseStreamEvent => event({
    type: 'response.completed',
    response: {id, model: 'test-model', usage: null}
});

const messageRound = (id = 'response-message'): ResponseStreamEvent[] => [
    responseCreated(id),
    event({
        type: 'response.output_text.delta',
        delta: JSON.stringify({
            presentation: 'message',
            answer: 'The requested work is complete.',
            caption: null,
            block_ids: []
        })
    }),
    responseCompleted(id)
];

const toolRound = (
    responseId: string,
    callId: string,
    name = 'query_dataset',
    args = '{"sql":"SELECT customer_number FROM customers"}'
): ResponseStreamEvent[] => [
    responseCreated(responseId),
    event({
        type: 'response.output_item.done',
        item: {type: 'function_call', call_id: callId, name, arguments: args}
    }),
    responseCompleted(responseId)
];

const failedRound = (id: string, message: string): ResponseStreamEvent[] => [
    responseCreated(id),
    event({
        type: 'response.failed',
        response: {id, model: 'test-model', error: {message}, usage: null}
    })
];

const dependenciesFor = (
    rounds: ResponseStreamEvent[][],
    executeTool: OpenAIChatDependencies['executeTool'] = async (): Promise<ToolExecution> => ({
        modelOutput: {ok: true},
        blocks: []
    })
): OpenAIChatDependencies => ({
    model: 'test-model',
    createResponse: async () =>
    {
        const next = rounds.shift();
        if (!next) throw new Error('No fake provider round remains');
        return (async function* ()
        {
            for (const item of next) yield item;
        })();
    },
    executeTool,
    issueCapabilities: () => undefined
});

const activitiesFrom = (events: ChatStreamEvent[]): ChatActivity[] =>
    events.flatMap((item) => item.type === 'activity.updated' ? [item.activity] : []);

const messageIdFrom = (events: ChatStreamEvent[]): string =>
{
    const started = events.find((item) => item.type === 'message.started');
    if (started?.type !== 'message.started') throw new Error('Expected a message.started event');
    return started.messageId;
};

describe('OpenAI chat activity lifecycle', () =>
{
    test('streams ordered request and compose activities for a direct response', async () =>
    {
        const events: ChatStreamEvent[] = [];
        const runner = createOpenAIChatRunner(dependenciesFor([messageRound()]));

        await runner({
            conversationId: 'conversation-direct-activity',
            input: {type: 'user_text', text: 'Say hello'}
        }, (next) => events.push(next), new AbortController().signal);

        const activities = activitiesFrom(events);
        const messageId = messageIdFrom(events);
        expect(activities.map(({kind, status}) => `${kind}:${status}`)).toEqual([
            'request:loading',
            'request:success',
            'compose:loading',
            'compose:success'
        ]);
        expect(activities.map(({id}) => id)).toEqual([
            `${messageId}:request`,
            `${messageId}:request`,
            `${messageId}:compose:1`,
            `${messageId}:compose:1`
        ]);
        expect(activities.every(({receipt}) => receipt === false)).toBeTrue();
        expect(events.at(-1)?.type).toBe('message.completed');
    });

    test('uses application-owned tool IDs while retaining legacy runner events', async () =>
    {
        const providerCallId = 'provider-call-private-1';
        const events: ChatStreamEvent[] = [];
        const runner = createOpenAIChatRunner(dependenciesFor([
            toolRound('response-tool', providerCallId),
            messageRound('response-final')
        ]));

        await runner({
            conversationId: 'conversation-tool-activity',
            input: {type: 'user_text', text: 'Show customers'}
        }, (next) => events.push(next), new AbortController().signal);

        const activities = activitiesFrom(events);
        const messageId = messageIdFrom(events);
        expect(activities.map(({kind, status}) => `${kind}:${status}`)).toEqual([
            'request:loading',
            'request:success',
            'data:loading',
            'data:success',
            'compose:loading',
            'compose:success'
        ]);
        expect(activities[2]).toMatchObject({
            id: `${messageId}:tool:1`,
            title: 'Checking the demo dataset',
            receipt: true
        });
        expect(activities[3]?.id).toBe(`${messageId}:tool:1`);
        const payload = JSON.stringify(activities);
        expect(payload).not.toContain(providerCallId);
        expect(payload).not.toContain('query_dataset');
        expect(payload).not.toContain('SELECT customer_number');
        expect(events.filter(({type}) => type === 'tool.started' || type === 'tool.completed')
            .map(({type}) => type)).toEqual(['tool.started', 'tool.completed']);
    });

    test('settles provider, tool, and cancellation failures without activity detail leaks', async () =>
    {
        const providerMessage = 'private provider diagnostic';
        const providerEvents: ChatStreamEvent[] = [];
        const providerRunner = createOpenAIChatRunner(dependenciesFor([
            failedRound('response-failed', providerMessage)
        ]));
        await expect(providerRunner({
            conversationId: 'conversation-provider-failure',
            input: {type: 'user_text', text: 'Help me'}
        }, (next) => providerEvents.push(next), new AbortController().signal)).rejects.toThrow(providerMessage);
        expect(activitiesFrom(providerEvents).map(({status}) => status)).toEqual(['loading', 'error']);
        expect(JSON.stringify(activitiesFrom(providerEvents))).not.toContain(providerMessage);

        const toolMessage = 'failed near SELECT * FROM private_table';
        const toolEvents: ChatStreamEvent[] = [];
        const toolRunner = createOpenAIChatRunner(dependenciesFor([
            toolRound('response-tool-failed', 'provider-call-failed')
        ], async () => { throw new Error(toolMessage); }));
        await expect(toolRunner({
            conversationId: 'conversation-tool-failure',
            input: {type: 'user_text', text: 'Show customers'}
        }, (next) => toolEvents.push(next), new AbortController().signal)).rejects.toThrow(toolMessage);
        expect(activitiesFrom(toolEvents).map(({kind, status}) => `${kind}:${status}`)).toEqual([
            'request:loading', 'request:success', 'data:loading', 'data:error'
        ]);
        expect(JSON.stringify(activitiesFrom(toolEvents))).not.toContain('private_table');

        const controller = new AbortController();
        const abortEvents: ChatStreamEvent[] = [];
        const abortDependencies = dependenciesFor([]);
        abortDependencies.createResponse = async () =>
        {
            controller.abort();
            throw new DOMException('private cancellation diagnostic', 'AbortError');
        };
        const abortRunner = createOpenAIChatRunner(abortDependencies);
        await expect(abortRunner({
            conversationId: 'conversation-aborted',
            input: {type: 'user_text', text: 'Help me'}
        }, (next) => abortEvents.push(next), controller.signal)).rejects.toThrow('private cancellation diagnostic');
        expect(activitiesFrom(abortEvents).map(({status}) => status)).toEqual(['loading', 'abort']);
    });

    test('keeps compose steps monotonic and ordered across repeated tool rounds and failure', async () =>
    {
        const providerCallIds = ['provider-call-private-1', 'provider-call-private-2'];
        const providerFailure = 'private final provider failure';
        const events: ChatStreamEvent[] = [];
        const tracedCallIds: string[] = [];
        const runner = createOpenAIChatRunner(dependenciesFor([
            toolRound('response-tool-1', providerCallIds[0] as string),
            toolRound('response-tool-2', providerCallIds[1] as string, 'search_policies', '{"query":"private"}'),
            failedRound('response-failed', providerFailure)
        ]));

        await expect(runner({
            conversationId: 'conversation-multi-round',
            input: {type: 'user_text', text: 'Research this'}
        }, (next) => events.push(next), new AbortController().signal, (progress) =>
        {
            if (progress.type === 'tool.completed') tracedCallIds.push(progress.tool.callId);
        })).rejects.toThrow(providerFailure);

        const activities = activitiesFrom(events);
        const messageId = messageIdFrom(events);
        expect(activities.map(({id, status}) => `${id}:${status}`)).toEqual([
            `${messageId}:request:loading`,
            `${messageId}:request:success`,
            `${messageId}:tool:1:loading`,
            `${messageId}:tool:1:success`,
            `${messageId}:compose:1:loading`,
            `${messageId}:compose:1:success`,
            `${messageId}:tool:2:loading`,
            `${messageId}:tool:2:success`,
            `${messageId}:compose:2:loading`,
            `${messageId}:compose:2:error`
        ]);
        expect(tracedCallIds).toEqual(providerCallIds);
        const publicPayload = JSON.stringify(activities);
        expect(publicPayload).not.toContain(providerCallIds[0] as string);
        expect(publicPayload).not.toContain(providerCallIds[1] as string);
        expect(publicPayload).not.toContain(providerFailure);
    });
});
