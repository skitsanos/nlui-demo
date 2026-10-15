import {expect, test} from 'bun:test';
import type {RouteContext} from '../core/types.ts';
import {InteractionCapabilityRegistry} from '../nlui/interactionCapabilities.ts';
import {emptyTokenUsage} from '../services/chatTrace.ts';
import {createOwnedChatHandler} from './chat.ts';
import {ConversationStore} from './store.ts';

test('real HTTP owned chat hides provider IDs, replays without executing again and denies another cookie jar', async () =>
{
    const store = new ConversationStore(':memory:');
    let calls = 0;
    const handler = createOwnedChatHandler({store, registry: new InteractionCapabilityRegistry(), run: async (_request, emit) =>
    {
        calls++;
        emit({type: 'message.started', messageId: 'owned-message'});
        emit({type: 'tool.started', name: 'private-tool'});
        emit({type: 'text.delta', delta: 'Owned answer.'});
        emit({type: 'message.completed', messageId: 'owned-message', responseId: 'PRIVATE_PROVIDER_ID'});
        return {messageId: 'owned-message', responseId: 'PRIVATE_PROVIDER_ID', model: 'test', promptVersion: 'test',
            text: 'Owned answer.', blocks: [], tools: [], rounds: [], usage: emptyTokenUsage(), durationMs: 1};
    }});
    const server = Bun.serve({hostname: '127.0.0.1', port: 0, fetch: (req, server) => handler({req, server, params: {}, query: {}, pathname: '/api/chat'} as unknown as RouteContext) as Promise<Response>});
    try
    {
        const body = {conversationId: 'conversation-http-owned', requestId: 'request-idempotent', input: {type: 'user_text', text: 'Hello'}};
        const send = (cookie?: string) => fetch(`http://127.0.0.1:${server.port}/api/chat`, {method: 'POST', headers: {'Content-Type': 'application/json', ...cookie && {Cookie: cookie}}, body: JSON.stringify(body)});
        const response = await send();
        const cookie = response.headers.get('Set-Cookie')!.split(';')[0]!;
        const text = await response.text();
        expect(text).not.toContain('PRIVATE_PROVIDER_ID');
        expect(text).not.toContain('private-tool');
        expect(text).toContain('request-idempotent');
        const replay = await send(cookie);
        expect(await replay.text()).toBe(text);
        expect(calls).toBe(1);
        const denied = await send();
        expect(denied.status).toBe(404);
        expect(calls).toBe(1);
    }
    finally {await server.stop(true); store.close();}
});

test('owned chat bounds a stalled runner, records interruption and rejects streamed oversized input', async () =>
{
    const store = new ConversationStore(':memory:');
    const handler = createOwnedChatHandler({store, registry: new InteractionCapabilityRegistry(), timeoutMs: 25, maximumBytes: 500,
        run: async () => await new Promise(() => undefined)});
    const context = (req: Request): RouteContext => ({req, server: {timeout: () => undefined}, params: {}, query: {}, pathname: '/api/chat'} as unknown as RouteContext);
    try
    {
        const response = await handler(context(new Request('http://demo.test/api/chat', {method: 'POST',
            body: JSON.stringify({conversationId: 'conversation-stalled', requestId: 'request-stalled', input: {type: 'user_text', text: 'Hello'}})}))) as Response;
        expect(await response.text()).toContain('timed out');
        const cookie = response.headers.get('Set-Cookie')!.match(/nlui_session=([^;]+)/)![1]!;
        const owner = store.session(cookie).owner;
        expect(store.replay(owner, 'conversation-stalled').interrupted).toEqual(['request-stalled']);
        const oversized = await handler(context(new Request('http://demo.test/api/chat', {method: 'POST',
            body: new ReadableStream({start(controller) {controller.enqueue(new Uint8Array(501)); controller.close();}})}))) as Response;
        expect(oversized.status).toBe(413);
    }
    finally {store.close();}
});
