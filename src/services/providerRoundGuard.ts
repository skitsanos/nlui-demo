import type {ResponseStreamEvent} from 'openai/resources/responses/responses';

/** A response identifier or parseable output is not a successful terminal event. */
export class ProviderRoundGuard
{
    private completed = false;
    private responseId?: string;

    accept(event: ResponseStreamEvent): void
    {
        if (this.completed) throw new Error('The model stream continued after completion');
        if ('response' in event && event.response.status === 'cancelled')
        {
            throw new DOMException('The response was cancelled', 'AbortError');
        }
        if (event.type === 'response.created' || event.type === 'response.completed')
        {
            const id = event.response.id;
            if (typeof id !== 'string' || !id.trim()) throw new Error('The model response identifier was invalid');
            if (this.responseId && this.responseId !== id) throw new Error('The model stream changed response identifiers');
            this.responseId = id;
        }
        if (event.type === 'response.completed')
        {
            if (event.response.status !== undefined && event.response.status !== 'completed')
            {
                throw new Error('The model completion event did not indicate success');
            }
            this.completed = true;
        }
    }

    finish(): void
    {
        if (!this.completed) throw new Error('The model stream ended without successful completion');
    }
}

export const cancellationStatus = (signal: AbortSignal, error: unknown): 'abort' | 'error' =>
    signal.aborted || (error instanceof Error && error.name === 'AbortError') ? 'abort' : 'error';
