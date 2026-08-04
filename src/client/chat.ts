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
}

export const streamChat = async ({conversationId, input, previousResponseId, signal, onEvent}: ChatStreamOptions): Promise<void> =>
{
    const response = await fetch('/api/chat', {
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
    let terminalEventSeen = false;
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
                terminalEventSeen ||= event.type === 'message.completed' || event.type === 'error';
                if (event.type === 'error') terminalError = event.message;
                onEvent(event);
            }
        }

        if (flush && pending.trim())
        {
            const event = JSON.parse(pending) as ChatStreamEvent;
            terminalEventSeen ||= event.type === 'message.completed' || event.type === 'error';
            if (event.type === 'error') terminalError = event.message;
            onEvent(event);
        }
    };

    while (true)
    {
        const {done, value} = await reader.read();
        if (done)
        {
            pending += decoder.decode();
            consumeLines(true);
            break;
        }

        pending += decoder.decode(value, {stream: true});
        consumeLines();
    }

    if (!terminalEventSeen && !signal.aborted)
    {
        throw new Error('The chat stream ended before a terminal event');
    }
    if (terminalError)
    {
        throw new Error(terminalError);
    }
};
