import {abortable} from '../utils/abort.ts';

export {abortable} from '../utils/abort.ts';
export const REQUEST_TIMEOUT_MESSAGE = 'The response timed out. Please try again.';

export class RequestDeadlineError extends Error
{
    constructor()
    {
        super(REQUEST_TIMEOUT_MESSAGE);
        this.name = 'RequestDeadlineError';
    }
}

export class RequestBodyTooLargeError extends Error {}

export const createRequestDeadline = (parent: AbortSignal, timeoutMs: number) =>
{
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new RangeError('A finite positive request deadline is required');
    const controller = new AbortController();
    const expiresAt = performance.now() + timeoutMs;
    const forwardAbort = () => controller.abort(parent.reason);
    parent.addEventListener('abort', forwardAbort, {once: true});
    if (parent.aborted) forwardAbort();
    const timer = setTimeout(() => controller.abort(new RequestDeadlineError()), timeoutMs);
    return {
        signal: controller.signal,
        check: () =>
        {
            if (performance.now() >= expiresAt) controller.abort(new RequestDeadlineError());
            controller.signal.throwIfAborted();
        },
        abort: () => controller.abort(),
        dispose: () => {clearTimeout(timer); parent.removeEventListener('abort', forwardAbort);}
    };
};

/** Own the reader so a deadline can cancel an unfinished request body. */
export const readRequestBytes = async (req: Request, signal: AbortSignal, maximumBytes: number): Promise<Uint8Array<ArrayBuffer>> =>
{
    if (!req.body) return new Uint8Array();
    const reader = req.body.getReader();
    const cancel = () => {void reader.cancel().catch(() => undefined);};
    signal.addEventListener('abort', cancel, {once: true});
    try
    {
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        while (true)
        {
            const chunk = await abortable(() => reader.read(), signal);
            if (chunk.done) break;
            bytes += chunk.value.byteLength;
            if (bytes > maximumBytes) throw new RequestBodyTooLargeError();
            chunks.push(chunk.value);
        }
        signal.throwIfAborted();
        const body = new Uint8Array(bytes); let offset = 0;
        for (const chunk of chunks) {body.set(chunk, offset); offset += chunk.byteLength;}
        return body;
    }
    finally
    {
        signal.removeEventListener('abort', cancel);
        void reader.cancel().catch(() => undefined);
        reader.releaseLock();
    }
};

export const readRequestJson = async (req: Request, signal: AbortSignal, maximumBytes = 50 * 1024 * 1024): Promise<unknown> =>
    JSON.parse(new TextDecoder().decode(await readRequestBytes(req, signal, maximumBytes)));
