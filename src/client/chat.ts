import type {ChatActivity, ChatInput, ChatStreamEvent, NluiBlock} from '../nlui/types.ts';

export interface ChatMessage
{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    blocks: NluiBlock[];
    activities: ChatActivity[];
    state: 'loading' | 'streaming' | 'complete' | 'error' | 'abort';
}

export interface ChatStreamOptions
{
    conversationId: string;
    input: ChatInput;
    previousResponseId?: string;
    signal: AbortSignal;
    onEvent: (event: ChatStreamEvent) => void;
    fetchChat?: (url: string, options: RequestInit) => Promise<Response>;
}

export const streamChat = async ({conversationId, input, previousResponseId, signal, onEvent, fetchChat = fetch}: ChatStreamOptions): Promise<void> =>
{
    signal.throwIfAborted();
    const response = await fetchChat('/api/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({conversationId, input, previousResponseId}),
        signal
    });

    if (!response.ok)
    {
        const message = await response.text();
        throw new Error(message || `Chat request failed (${response.status})`);
    }

    if (!response.body)
    {
        throw new Error('The chat response did not include a stream');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    let completedEventSeen = false;
    let terminalError: string | undefined;

    const consumeLines = (flush = false): void =>
    {
        const lines = pending.split('\n');
        pending = flush ? '' : (lines.pop() ?? '');

        for (const line of lines)
        {
            if (line.trim())
            {
                const event = JSON.parse(line) as ChatStreamEvent;
                signal.throwIfAborted();
                completedEventSeen ||= event.type === 'message.completed';
                if (event.type === 'error') terminalError = event.message;
                onEvent(event);
            }
        }

        if (flush && pending.trim())
        {
            const event = JSON.parse(pending) as ChatStreamEvent;
            signal.throwIfAborted();
            completedEventSeen ||= event.type === 'message.completed';
            if (event.type === 'error') terminalError = event.message;
            onEvent(event);
        }
    };

    let ended = false;
    try
    {
        while (true)
        {
            signal.throwIfAborted();
            const {done, value} = await reader.read();
            signal.throwIfAborted();
            if (done)
            {
                ended = true;
                pending += decoder.decode();
                consumeLines(true);
                break;
            }

            pending += decoder.decode(value, {stream: true});
            consumeLines();
        }
    }
    finally
    {
        if (!ended) void reader.cancel().catch(() => undefined);
        reader.releaseLock();
    }
    if (terminalError !== undefined)
    {
        throw new Error(terminalError);
    }
    if (!completedEventSeen) throw new Error('The chat stream ended before a terminal event');
};
