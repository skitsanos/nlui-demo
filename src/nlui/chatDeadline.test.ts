import {afterEach, describe, expect, test} from 'bun:test';
import type {RouteContext, SocketData} from '../core/types.ts';
import {createChatHandler} from '../routes/api/chat/index.ts';
import {REQUEST_TIMEOUT_MESSAGE} from '../server/requestDeadline.ts';
import {emptyTokenUsage} from '../services/chatTrace.ts';
import type {OpenAIChatRunner} from '../services/openaiChatRunner.ts';
import {ConversationStateRegistry} from './conversationState.ts';
import {InteractionCapabilityRegistry} from './interactionCapabilities.ts';
import type {ChatRequest, ChatStreamEvent, FormBlock} from './types.ts';

const servers: Bun.Server<SocketData>[] = [];
afterEach(async () => {for (const server of servers.splice(0)) await server.stop(true);});
const payload: ChatRequest = {conversationId: 'deadline-conversation', input: {type: 'user_text', text: 'Help me'}};
const req = (input = payload): Request => new Request('http://demo.test/api/chat', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(input)
});
const context = (request: Request): RouteContext => ({req: request, server: {timeout: () => undefined}} as unknown as RouteContext);
const eventsFrom = async (response: Response): Promise<ChatStreamEvent[]> =>
    (await response.text()).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
const result = (responseId: string) => ({messageId: 'message-test', responseId, model: 'test-model', promptVersion: 'test',
    text: '', blocks: [], tools: [], rounds: [], usage: emptyTokenUsage(), durationMs: 1});

describe('absolute chat deadline', () =>
{
    test('never disables the transport idle timeout', async () =>
    {
        const idle: number[] = [];
        const handler = createChatHandler({states: new ConversationStateRegistry(), timeoutMs: 500, runChat: async () => result('transport-response')});
        const requestContext = {...context(req()), server: {timeout: (_req: Request, seconds: number) => {idle.push(seconds);}}} as unknown as RouteContext;
        const response = await handler(requestContext) as Response;
        await response.text();
        expect(idle).toEqual([1]);
    });

    test('a non-cooperative runner receives cancellation and cannot keep the HTTP stream open', async () =>
    {
        let signal: AbortSignal | undefined;
        const states = new ConversationStateRegistry();
        const handler = createChatHandler({states, timeoutMs: 60, runChat: async (_request, emit, nextSignal) =>
        {
            signal = nextSignal;
            emit({type: 'message.started', messageId: 'message-stall'});
            return new Promise(() => undefined);
        }});
        const server = Bun.serve<SocketData>({hostname: '127.0.0.1', port: 0,
            fetch: (request, running) => handler({req: request, server: running, params: {}, query: {}, pathname: '/api/chat'}),
            websocket: {message: () => undefined}});
        servers.push(server);
        const started = performance.now();
        const response = await fetch(server.url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)});
        const events = await eventsFrom(response);
        expect(response.status).toBe(200);
        expect(performance.now() - started).toBeLessThan(1_000);
        expect(events.at(-1)).toEqual({type: 'error', message: REQUEST_TIMEOUT_MESSAGE});
        expect(events.filter(({type}) => type === 'error')).toHaveLength(1);
        expect(events.some(({type}) => type === 'message.completed')).toBeFalse();
        expect(signal?.aborted).toBeTrue();
        expect(() => states.begin(payload.conversationId)).not.toThrow();
        states.release(payload.conversationId);
    });

    test('a stalled request body is cancelled with 408 before any runner starts', async () =>
    {
        let bodyCancelled = false;
        let calls = 0;
        const body = new ReadableStream<Uint8Array>({start(output) {output.enqueue(new TextEncoder().encode('{'));},
            cancel() {bodyCancelled = true;}});
        const request = new Request('http://demo.test/api/chat', {method: 'POST', body});
        const handler = createChatHandler({timeoutMs: 25, runChat: async () => {calls += 1; return result('must-not-run');}});
        const response = await handler(context(request)) as Response;
        expect(response.status).toBe(408);
        expect(await response.json()).toEqual({message: REQUEST_TIMEOUT_MESSAGE});
        expect(bodyCancelled).toBeTrue();
        expect(calls).toBe(0);
    });

    test('a timed-out UI continuation releases the submission and keeps its previous response ID', async () =>
    {
        const states = new ConversationStateRegistry();
        const capabilities = new InteractionCapabilityRegistry();
        const form: FormBlock = {id: 'form-one', type: 'form', interactionId: 'interaction-one', submitLabel: 'Continue',
            fields: [{input: 'text', name: 'reason', label: 'Reason', required: true}]};
        states.begin(payload.conversationId);
        states.complete(payload.conversationId, 'previous-response');
        capabilities.issue(payload.conversationId, form);
        const handler = createChatHandler({states, capabilities, timeoutMs: 25, runChat: async () => new Promise(() => undefined)});
        const response = await handler(context(req({conversationId: payload.conversationId, previousResponseId: 'previous-response',
            input: {type: 'ui_result', interactionId: form.interactionId, values: {reason: 'Retry safely'}}}))) as Response;
        expect((await eventsFrom(response)).at(-1)).toEqual({type: 'error', message: REQUEST_TIMEOUT_MESSAGE});
        expect(capabilities.consume(payload.conversationId, form.interactionId, {reason: 'Retry safely'})).toEqual({reason: 'Retry safely'});
        expect(() => states.begin(payload.conversationId, 'previous-response')).not.toThrow();
        states.release(payload.conversationId);
    });

    test('late completion cannot publish or release/overwrite a successful retry turn', async () =>
    {
        const states = new ConversationStateRegistry();
        let lateEmit: (event: ChatStreamEvent) => void;
        let lateResolve: (value: Awaited<ReturnType<OpenAIChatRunner>>) => void;
        const handler = createChatHandler({states, timeoutMs: 25, runChat: async (_request, emit) =>
        {
            lateEmit = emit;
            return new Promise((resolve) => {lateResolve = resolve;});
        }});
        const expired = await handler(context(req())) as Response;
        expect((await eventsFrom(expired)).at(-1)?.type).toBe('error');
        const retry = createChatHandler({states, timeoutMs: 500, runChat: async (_request, emit) =>
        {
            emit({type: 'message.completed', messageId: 'retry-message', responseId: 'retry-response'});
            return result('retry-response');
        }});
        const retryResponse = await retry(context(req())) as Response;
        expect((await eventsFrom(retryResponse)).at(-1)?.type).toBe('message.completed');
        lateEmit!({type: 'message.completed', messageId: 'late-message', responseId: 'late-response'});
        lateResolve!(result('late-response'));
        await Promise.resolve(); await Promise.resolve();
        expect(() => states.begin(payload.conversationId, 'late-response')).toThrow();
        expect(() => states.begin(payload.conversationId, 'retry-response')).not.toThrow();
        states.release(payload.conversationId);
    });

    test('an elapsed deadline is checked before publishing even when synchronous work delayed the timer', async () =>
    {
        const handler = createChatHandler({states: new ConversationStateRegistry(), timeoutMs: 30, runChat: async (_request, emit) =>
        {
            const end = performance.now() + 50;
            while (performance.now() < end) { /* Deliberate bounded event-loop starvation. */ }
            emit({type: 'message.completed', messageId: 'late-message', responseId: 'late-response'});
            return result('late-response');
        }});
        const response = await handler(context(req())) as Response;
        const events = await eventsFrom(response);
        expect(events).toEqual([{type: 'error', message: REQUEST_TIMEOUT_MESSAGE}]);
    });

    test('healthy completion cancels its deadline timer and emits completion exactly once', async () =>
    {
        let signal: AbortSignal;
        const handler = createChatHandler({states: new ConversationStateRegistry(), timeoutMs: 25, runChat: async (_request, emit, nextSignal) =>
        {
            signal = nextSignal;
            emit({type: 'message.completed', messageId: 'healthy-message', responseId: 'healthy-response'});
            return result('healthy-response');
        }});
        const response = await handler(context(req())) as Response;
        expect((await eventsFrom(response)).filter(({type}) => type === 'message.completed')).toHaveLength(1);
        await Bun.sleep(35);
        expect(signal!.aborted).toBeFalse();
    });

    test('reader cancellation aborts work without an extra terminal error or a held conversation', async () =>
    {
        const states = new ConversationStateRegistry();
        let released: () => void;
        const done = new Promise<void>((resolve) => {released = resolve;});
        const release = states.release.bind(states);
        states.release = (id) => {release(id); released();};
        let signal: AbortSignal;
        const handler = createChatHandler({states, timeoutMs: 500, runChat: async (_request, emit, nextSignal) =>
        {
            signal = nextSignal;
            emit({type: 'message.started', messageId: 'reader-cancel-message'});
            return new Promise(() => undefined);
        }});
        const response = await handler(context(req())) as Response;
        const reader = response.body!.getReader();
        await reader.read();
        await reader.cancel();
        await done;
        expect(signal!.aborted).toBeTrue();
        expect(() => states.begin(payload.conversationId)).not.toThrow();
        states.release(payload.conversationId);
    });
});
