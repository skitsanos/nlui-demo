import {describe, expect, test} from 'bun:test';
import {createRequestDeadline, RequestBodyTooLargeError, readRequestJson } from './requestDeadline.ts';

describe('cancellable request body reading', () =>
{
    test('a streamed body cannot bypass its byte limit, including multibyte text', async () =>
    {
        let cancelled = false;
        const body = new ReadableStream<Uint8Array>({start(output) {output.enqueue(new TextEncoder().encode('"✓✓"'));},
            cancel() {cancelled = true;}});
        const request = new Request('http://test/api/chat', {method: 'POST', body});
        await expect(readRequestJson(request, new AbortController().signal, 6)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
        expect(cancelled).toBeTrue();
    });

    test('incremental UTF-8 decoding preserves complete JSON without splitting characters', async () =>
    {
        const bytes = new TextEncoder().encode('{"text":"✓"}');
        const body = new ReadableStream<Uint8Array>({start(output)
        {
            for (const byte of bytes) output.enqueue(new Uint8Array([byte]));
            output.close();
        }});
        expect(await readRequestJson(new Request('http://test/api/chat', {method: 'POST', body}), new AbortController().signal))
            .toEqual({text: '✓'});
    });

    test('disposing a healthy deadline removes both its timer and parent abort listener', async () =>
    {
        const parent = new AbortController();
        const deadline = createRequestDeadline(parent.signal, 10);
        deadline.dispose();
        parent.abort();
        await Bun.sleep(15);
        expect(deadline.signal.aborted).toBeFalse();
    });
});
