import {type ActionFailure, actionFailureSchema, actionSuccessSchema, GENERIC_PUBLIC_ACTION_ERROR} from '../nlui/actionResponse.ts';
import type {ResultBlock} from '../nlui/types.ts';
import {abortable} from '../utils/abort.ts';

export interface ConfirmationIdentity {conversationId: string; interactionId: string; actionId: string}
export type ConfirmationOutcome = {outcome: 'completed'; block: ResultBlock; replayed: boolean} | ActionFailure;
export type RequestConfirmation = (identity: ConfirmationIdentity, signal: AbortSignal) => Promise<ConfirmationOutcome>;
export type FetchAction = (url: string, options: RequestInit) => Promise<Response>;
const unknownOutcome = (): ActionFailure => ({outcome: 'unknown', retryable: true, message: GENERIC_PUBLIC_ACTION_ERROR});

/** Never infer rollback from transport failure, HTTP status alone, or an invalid response. */
export const requestConfirmation = async (
    identity: ConfirmationIdentity,
    parent: AbortSignal,
    {fetchAction = fetch, timeoutMs = 20_000}: {fetchAction?: FetchAction; timeoutMs?: number} = {}
): Promise<ConfirmationOutcome> =>
{
    const controller = new AbortController();
    const abort = () => controller.abort();
    parent.addEventListener('abort', abort, {once: true});
    if (parent.aborted) abort();
    const timer = setTimeout(abort, timeoutMs);
    try
    {
        const response = await abortable(() => fetchAction('/api/actions', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(identity), signal: controller.signal
        }), controller.signal);
        const payload: unknown = await abortable(() => response.json(), controller.signal);
        if (response.ok)
        {
            const parsed = actionSuccessSchema.safeParse(payload);
            if (parsed.success && parsed.data.block.type === 'result')
                return {outcome: 'completed', block: parsed.data.block, replayed: parsed.data.replayed === true};
        }
        else
        {
            const failure = actionFailureSchema.safeParse(payload);
            if (failure.success && (
                failure.data.outcome === 'rejected' && response.status === 409
                || failure.data.outcome === 'unavailable' && response.status === 400
                || failure.data.outcome === 'unknown' && [409, 500].includes(response.status)
            )) return failure.data;
        }
        return unknownOutcome();
    }
    catch {return unknownOutcome();}
    finally
    {
        clearTimeout(timer);
        parent.removeEventListener('abort', abort);
    }
};
