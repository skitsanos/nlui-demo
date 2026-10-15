import {describe, expect, test} from 'bun:test';
import type {ResponseStreamEvent} from 'openai/resources/responses/responses';
import type {RouteContext} from '../core/types.ts';
import {createChatHandler} from '../routes/api/chat/index.ts';
import {emptyTokenUsage} from '../services/chatTrace.ts';
import {createOpenAIChatRunner} from '../services/openaiChatRunner.ts';
import {GENERIC_PUBLIC_CHAT_ERROR} from '../services/publicChatStream.ts';
import {ConversationStateRegistry} from './conversationState.ts';
import {InteractionCapabilityRegistry} from './interactionCapabilities.ts';
import type {ChatRequest, ChatStreamEvent, FormBlock} from './types.ts';

const conversationId = 'conversation-route-test';
const form: FormBlock = {
    id: 'form-retry', type: 'form', interactionId: 'interaction-retry', submitLabel: 'Continue',
    fields: [{input: 'text', name: 'reason', label: 'Reason', required: true}]
};
const request = (body: ChatRequest, signal?: AbortSignal): Request => new Request('http://demo.test/api/chat', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), signal
});
const context = (req: Request): RouteContext => ({req, server: {timeout: () => undefined}} as unknown as RouteContext);
const streamEvents = async (response: Response): Promise<ChatStreamEvent[]> =>
    (await response.text()).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as ChatStreamEvent);
const partialRound = (): ResponseStreamEvent[] => [
    {type: 'response.created', response: {id: 'uncompleted-response', model: 'test-model'}},
    {type: 'response.output_text.delta', delta: JSON.stringify({
        presentation: 'message', answer: 'Provisional answer.', caption: null, block_ids: []
    })}
] as ResponseStreamEvent[];

describe('chat route completion boundary', () =>
{
    test.each([false, true])('an incomplete stream releases its turn without advancing response state (previous turn: %s)', async (previous) =>
    {
        const states = new ConversationStateRegistry();
        const capabilities = new InteractionCapabilityRegistry();
        if (previous)
        {
            states.begin(conversationId);
            states.complete(conversationId, 'previous-response');
        }
        let issued = false;
        const handler = createChatHandler({states, capabilities, runChat: createOpenAIChatRunner({
            model: 'test-model',
            createResponse: async () => (async function* () {for (const item of partialRound()) yield item;})(),
            executeTool: async () => {throw new Error('Unexpected tool execution');},
            issueCapabilities: () => {issued = true;}
        })});
        const response = await handler(context(request({conversationId,
            previousResponseId: previous ? 'previous-response' : undefined,
            input: {type: 'user_text', text: 'Help me'}}))) as Response;
        const events = await streamEvents(response);
        expect(events.at(-1)).toEqual({type: 'error', message: GENERIC_PUBLIC_CHAT_ERROR});
        expect(events.some(({type}) => type === 'message.completed' || type === 'text.delta' || type === 'ui.block')).toBeFalse();
        expect(issued).toBeFalse();
        expect(() => states.begin(conversationId, 'uncompleted-response')).toThrow();
        expect(() => states.begin(conversationId, previous ? 'previous-response' : undefined)).not.toThrow();
        states.release(conversationId);
    });

    test('failed UI continuation releases its submission for a safe retry', async () =>
    {
        const states = new ConversationStateRegistry();
        const capabilities = new InteractionCapabilityRegistry();
        states.begin(conversationId);
        states.complete(conversationId, 'previous-response');
        capabilities.issue(conversationId, form);
        const handler = createChatHandler({states, capabilities, runChat: createOpenAIChatRunner({
            model: 'test-model',
            createResponse: async () => (async function* () {for (const item of partialRound()) yield item;})(),
            executeTool: async () => {throw new Error('Unexpected tool execution');},
            issueCapabilities: () => {throw new Error('Unexpected capability issuance');}
        })});
        const response = await handler(context(request({conversationId, previousResponseId: 'previous-response',
            input: {type: 'ui_result', interactionId: form.interactionId, values: {reason: 'Try again'}}}))) as Response;
        expect((await streamEvents(response)).at(-1)).toEqual({type: 'error', message: GENERIC_PUBLIC_CHAT_ERROR});
        expect(capabilities.consume(conversationId, form.interactionId, {reason: 'Try again'})).toEqual({reason: 'Try again'});
        expect(() => states.begin(conversationId, 'previous-response')).not.toThrow();
        states.release(conversationId);
    });

    test('late request cancellation between runner resolution and route state commit cannot advance the chain', async () =>
    {
        const controller = new AbortController();
        const states = new ConversationStateRegistry();
        let settled: () => void;
        const finished = new Promise<void>((done) => {settled = done;});
        const originalRelease = states.release.bind(states);
        states.release = (id) => {originalRelease(id); settled();};
        const handler = createChatHandler({states, runChat: async () =>
        {
            // The cancellation arrives after the runner's own work but before
            // the route's .then callback commits the provider response ID.
            queueMicrotask(() => controller.abort());
            return {messageId: 'message-late', responseId: 'cancelled-response', model: 'test-model',
                promptVersion: 'test', text: '', blocks: [], tools: [], rounds: [], usage: emptyTokenUsage(), durationMs: 1};
        }});
        const response = await handler(context(request({conversationId,
            input: {type: 'user_text', text: 'Help me'}}, controller.signal))) as Response;
        await finished;
        await response.body?.cancel();
        expect(() => states.begin(conversationId, 'cancelled-response')).toThrow();
        expect(() => states.begin(conversationId)).not.toThrow();
        states.release(conversationId);
    });

    test('a completed provider turn advances only its own conversation', async () =>
    {
        const states = new ConversationStateRegistry();
        const handler = createChatHandler({states, runChat: createOpenAIChatRunner({
            model: 'test-model',
            createResponse: async () => (async function* ()
            {
                for (const item of partialRound()) yield item;
                yield {type: 'response.completed', response: {
                    id: 'uncompleted-response', model: 'test-model', status: 'completed', usage: null
                }} as unknown as ResponseStreamEvent;
            })(),
            executeTool: async () => {throw new Error('Unexpected tool execution');},
            issueCapabilities: () => undefined
        })});
        const response = await handler(context(request({conversationId,
            input: {type: 'user_text', text: 'Help me'}}))) as Response;
        expect((await streamEvents(response)).at(-1)?.type).toBe('message.completed');
        expect(() => states.begin('another-conversation', 'uncompleted-response')).toThrow();
        expect(() => states.begin(conversationId, 'uncompleted-response')).not.toThrow();
        states.release(conversationId);
    });
});
