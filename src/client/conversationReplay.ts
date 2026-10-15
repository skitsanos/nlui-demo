import {inputText} from '../conversations/history.ts';
import type {StoredEvent} from '../conversations/store.ts';
import type {ChatMessage} from './chat.ts';
import {reduceAssistantEvent} from './chatActivity.ts';

export type ControlState = 'available' | 'submitted' | 'expired' | 'completed' | 'executing' | 'superseded';
export interface ConversationSnapshot
{
    events: StoredEvent[];
    head?: string;
    interrupted: string[];
    running: boolean;
    states: Record<string, ControlState>;
    nextCursor?: number;
    hasMore?: boolean;
}

export const replayMessages = (snapshot: ConversationSnapshot): ChatMessage[] =>
{
    const messages: ChatMessage[] = [];
    const assistants = new Map<string, ChatMessage>();
    const seen = new Set<number>();
    for (const {sequence, requestId, event} of snapshot.events.toSorted((a, b) => a.sequence - b.sequence))
    {
        if (seen.has(sequence)) continue;
        seen.add(sequence);
        if (event.type === 'user.input')
        {
            messages.push({id: `user:${requestId}`, role: 'user', content: event.displayText ?? inputText(event.input), blocks: [], activities: [], state: 'complete'});
            continue;
        }
        let assistant = assistants.get(requestId);
        if (!assistant)
        {
            assistant = {id: `assistant:${requestId}`, role: 'assistant', content: '', blocks: [], activities: [], state: 'loading'};
            assistants.set(requestId, assistant);
            messages.push(assistant);
        }
        Object.assign(assistant, reduceAssistantEvent(assistant, event));
    }
    for (const [id, message] of assistants)
    {
        if (snapshot.interrupted.includes(id))
        {
            message.state = 'abort';
            message.activities = message.activities.map((activity) => activity.status === 'loading' ? {...activity, status: 'abort'} : activity);
            if (!message.content && !message.blocks.length) message.content = 'This response was interrupted. You can send a new message to continue.';
        }
    }
    for (const requestId of snapshot.interrupted) if (!assistants.has(requestId))
        messages.push({id: `assistant:${requestId}`, role: 'assistant', content: 'This response was interrupted before it could finish. Send a new message to continue.',
            blocks: [], activities: [], state: 'abort'});
    return messages;
};

export const readConversation = async (conversationId: string, signal?: AbortSignal): Promise<ConversationSnapshot | undefined> =>
{
    const response = await fetch(`/api/conversations?conversationId=${encodeURIComponent(conversationId)}`, {signal});
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error('Conversation history is unavailable.');
    const snapshot = await response.json() as ConversationSnapshot;
    while (snapshot.hasMore)
    {
        const next = await fetch(`/api/conversations?conversationId=${encodeURIComponent(conversationId)}&after=${snapshot.nextCursor}`, {signal});
        if (!next.ok) throw new Error('Conversation replay was interrupted.');
        const page = await next.json() as ConversationSnapshot;
        if ((page.nextCursor ?? 0) <= (snapshot.nextCursor ?? 0)) throw new Error('Conversation replay did not advance.');
        snapshot.events.push(...page.events); snapshot.nextCursor = page.nextCursor; snapshot.hasMore = page.hasMore;
        snapshot.head = page.head; snapshot.interrupted = page.interrupted; snapshot.running = page.running; snapshot.states = page.states;
    }
    return snapshot;
};
