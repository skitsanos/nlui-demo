import {describe, expect, test} from 'bun:test';
import {GENERIC_PUBLIC_ACTION_ERROR, UNAVAILABLE_ACTION_MESSAGE} from '../nlui/actionResponse.ts';
import {requestConfirmation} from './confirmationRequest.ts';

const identity = {conversationId: 'confirmation-test', interactionId: 'interaction-one', actionId: 'action-one'};
const block = {id: 'result-one', type: 'result', status: 'success', message: 'Completed'} as const;
const unknown = {outcome: 'unknown', retryable: true, message: GENERIC_PUBLIC_ACTION_ERROR} as const;
const request = (response: Response) => requestConfirmation(identity, new AbortController().signal,
    {fetchAction: async () => response});

describe('confirmation response boundary', () =>
{
    test('posts the unchanged capability identity and validates a replayed result', async () =>
    {
        const outcome = await requestConfirmation(identity, new AbortController().signal, {fetchAction: (async (url, options) =>
        {
            expect(url).toBe('/api/actions');
            expect(options?.method).toBe('POST');
            expect(JSON.parse(options!.body as string)).toEqual(identity);
            expect(options?.signal).toBeInstanceOf(AbortSignal);
            return Response.json({block, replayed: true});
        })});
        expect(outcome).toEqual({outcome: 'completed', block, replayed: true});
    });

    test.each([
        [409, {outcome: 'rejected', retryable: false, message: 'The requested action has expired'}],
        [400, {outcome: 'unavailable', retryable: false, message: UNAVAILABLE_ACTION_MESSAGE}],
        [500, unknown], [409, unknown]
    ] as const)('recognizes a structured failure for HTTP %s', async (status, payload) =>
    {
        expect(await request(Response.json(payload, {status}))).toEqual(payload);
    });

    test.each([
        new Response('upstream disconnected', {status: 502}),
        Response.json({message: 'private diagnostic'}, {status: 409}),
        Response.json({outcome: 'rejected', retryable: false, message: 'private diagnostic'}, {status: 409}),
        Response.json({outcome: 'rejected', retryable: false, message: 'The requested action has expired'}, {status: 500}),
        Response.json({block: {...block, status: 'error'}}),
        Response.json({block: {...block, type: 'table'}}),
        Response.json({block: {...block, message: 123}}),
        new Response('not json')
    ])('treats malformed, proxy or contradictory responses as uncertain', async (response) =>
    {
        expect(await request(response)).toEqual(unknown);
    });

    test('a thrown transport error never becomes user-visible exception text', async () =>
    {
        expect(await requestConfirmation(identity, new AbortController().signal, {fetchAction: (async () =>
        {throw new Error('/private/server.sqlite');})})).toEqual(unknown);
    });

    test('bounds a fetch that ignores cancellation', async () =>
    {
        let signal: AbortSignal;
        const outcome = await requestConfirmation(identity, new AbortController().signal, {timeoutMs: 10,
            fetchAction: (_url, options) => {signal = options!.signal!; return new Promise(() => undefined);}});
        expect(outcome).toEqual(unknown);
        expect(signal!.aborted).toBeTrue();
    });

    test('bounds a stalled response body as well as response headers', async () =>
    {
        const response = new Response(new ReadableStream({start(output) {output.enqueue(new TextEncoder().encode('{'));}}));
        expect(await requestConfirmation(identity, new AbortController().signal, {timeoutMs: 10,
            fetchAction: async () => response})).toEqual(unknown);
    });

    test('a pre-aborted caller never sends a request', async () =>
    {
        let calls = 0;
        const controller = new AbortController();
        controller.abort();
        expect(await requestConfirmation(identity, controller.signal, {fetchAction: (async () =>
        {calls += 1; return Response.json({block});})})).toEqual(unknown);
        expect(calls).toBe(0);
    });

    test('healthy completion clears its timer and detaches the caller cancellation listener', async () =>
    {
        const parent = new AbortController();
        let signal: AbortSignal;
        await requestConfirmation(identity, parent.signal, {timeoutMs: 10, fetchAction: async (_url, options) =>
        {signal = options.signal!; return Response.json({block});}});
        parent.abort();
        await Bun.sleep(20);
        expect(signal!.aborted).toBeFalse();
    });
});
