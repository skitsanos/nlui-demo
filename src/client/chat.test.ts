import {describe, expect, test} from 'bun:test';
import type {ChatStreamEvent} from '../nlui/types.ts';
import {streamChat} from './chat.ts';

const run = (response: Response, controller = new AbortController(), events: ChatStreamEvent[] = []) => streamChat({
    conversationId: 'continuation-test', input: {type: 'ui_result', interactionId: 'confirmation-one',
        values: {outcome: 'confirmed', action_id: 'action-one'}}, signal: controller.signal,
    onEvent: (event) => events.push(event), fetchChat: async () => response
});

describe('confirmation chat continuation completion', () =>
{
    test('only a real completion, including one without a final newline, succeeds', async () =>
    {
        const events: ChatStreamEvent[] = [];
        await run(new Response(JSON.stringify({type: 'message.completed', messageId: 'message-one', responseId: 'response-one'})), undefined, events);
        expect(events).toEqual([{type: 'message.completed', messageId: 'message-one', responseId: 'response-one'}]);
    });

    test('a quietly aborted stream is not reported as a successful interaction', async () =>
    {
        const controller = new AbortController();
        const response = new Response(new ReadableStream({start(output) {queueMicrotask(() => {controller.abort(); output.close();});}}));
        await expect(run(response, controller)).rejects.toThrow();
    });

    test('late completion after caller cancellation cannot reach the response-chain callback', async () =>
    {
        const controller = new AbortController();
        const events: ChatStreamEvent[] = [];
        let output: ReadableStreamDefaultController<Uint8Array>;
        const response = new Response(new ReadableStream<Uint8Array>({start(value) {output = value;}}));
        const pending = run(response, controller, events);
        await Promise.resolve();
        controller.abort();
        output!.enqueue(new TextEncoder().encode(`${JSON.stringify({type: 'message.completed', responseId: 'late-response'})}\n`));
        output!.close();
        await expect(pending).rejects.toThrow();
        expect(events).toEqual([]);
    });

    test.each(['', 'The continuation failed'])('even an error with message %s remains a failed continuation', async (message) =>
    {
        await expect(run(new Response(`${JSON.stringify({type: 'error', message})}\n`))).rejects.toThrow();
    });

    test('incomplete and malformed streams cannot consume the retry affordance', async () =>
    {
        await expect(run(new Response(''))).rejects.toThrow('before a terminal event');
        let cancelled = false;
        const response = new Response(new ReadableStream({start(output) {output.enqueue(new TextEncoder().encode('not json\n'));},
            cancel() {cancelled = true;}}));
        await expect(run(response)).rejects.toThrow();
        expect(cancelled).toBeTrue();
    });
});
