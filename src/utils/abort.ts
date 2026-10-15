/** Bound waiting even when a dependency ignores cancellation. Late rejection is handled. */
export const abortable = async <T>(operation: () => T | PromiseLike<T>, signal: AbortSignal): Promise<T> =>
{
    signal.throwIfAborted();
    let rejectAbort: () => void;
    const aborted = new Promise<never>((_resolve, reject) =>
    {
        rejectAbort = () => reject(signal.reason);
        signal.addEventListener('abort', rejectAbort, {once: true});
    });
    try
    {
        const result = await Promise.race([
            Promise.resolve().then(() => {signal.throwIfAborted(); return operation();}), aborted
        ]);
        signal.throwIfAborted();
        return result;
    }
    finally
    {
        signal.removeEventListener('abort', rejectAbort!);
    }
};

/** Do not wait indefinitely for an iterator that ignores the cancellation signal. */
export async function* abortableEvents<T>(source: AsyncIterable<T>, signal: AbortSignal): AsyncGenerator<T>
{
    const iterator = source[Symbol.asyncIterator]();
    let finished = false;
    try
    {
        while (true)
        {
            const step = await abortable(() => iterator.next(), signal);
            if (step.done) {finished = true; return;}
            yield step.value;
        }
    }
    finally
    {
        if (!finished)
        {
            try {void Promise.resolve(iterator.return?.()).catch(() => undefined);}
            catch { /* Cancellation must not depend on uncooperative cleanup. */ }
        }
    }
}
