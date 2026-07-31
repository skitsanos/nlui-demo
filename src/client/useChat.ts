import {useCallback, useRef, useState} from 'react';
import type {ChatInput, ChatStreamEvent} from '../nlui/types.ts';
import {type ChatMessage, streamChat} from './chat.ts';
import {createClientId} from './id.ts';

export const useChat = () =>
{
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState(() => createClientId('conversation'));
    const previousResponseId = useRef<string | undefined>(undefined);
    const abortController = useRef<AbortController | undefined>(undefined);
    const activeRequestId = useRef<string | undefined>(undefined);

    const updateAssistant = useCallback((id: string, event: ChatStreamEvent): void =>
    {
        setMessages((current) => current.map((message) =>
        {
            if (message.id !== id)
            {
                return message;
            }

            switch (event.type)
            {
                case 'text.delta':
                    return {...message, content: message.content + event.delta, state: 'streaming', activity: undefined};
                case 'ui.block':
                    return {...message, blocks: [...message.blocks, event.block]};
                case 'tool.started':
                    return {...message, activity: `Using ${event.name.replaceAll('_', ' ')}…`};
                case 'tool.completed':
                    return {...message, activity: undefined};
                case 'message.completed':
                    return {...message, state: 'complete', activity: undefined};
                case 'error':
                    return {...message, content: event.message, state: 'error', activity: undefined};
                default:
                    return message;
            }
        }));
    }, []);

    const submit = useCallback(async (input: ChatInput, displayText: string): Promise<boolean> =>
    {
        if (activeRequestId.current)
        {
            return false;
        }

        const requestId = createClientId('request');
        const assistantId = createClientId('assistant');
        const controller = new AbortController();
        activeRequestId.current = requestId;
        abortController.current = controller;
        setLoading(true);
        setMessages((current) => [
            ...current,
            {id: createClientId('user'), role: 'user', content: displayText, blocks: [], state: 'complete'},
            {id: assistantId, role: 'assistant', content: '', blocks: [], state: 'loading'}
        ]);

        let completed = false;
        try
        {
            await streamChat({
                conversationId,
                input,
                previousResponseId: previousResponseId.current,
                signal: controller.signal,
                onEvent: (event) =>
                {
                    updateAssistant(assistantId, event);
                    if (event.type === 'message.completed')
                    {
                        previousResponseId.current = event.responseId;
                    }
                }
            });
            completed = true;
        }
        catch (error)
        {
            if (!controller.signal.aborted)
            {
                const message = error instanceof Error ? error.message : 'The request failed';
                updateAssistant(assistantId, {type: 'error', message});
            }
        }
        finally
        {
            if (activeRequestId.current === requestId)
            {
                setLoading(false);
                activeRequestId.current = undefined;
                abortController.current = undefined;
            }
        }
        return completed;
    }, [conversationId, updateAssistant]);

    const reset = useCallback((): void =>
    {
        abortController.current?.abort();
        activeRequestId.current = undefined;
        abortController.current = undefined;
        previousResponseId.current = undefined;
        setConversationId(createClientId('conversation'));
        setMessages([]);
        setLoading(false);
    }, []);

    const cancel = useCallback((): void =>
    {
        if (!activeRequestId.current)
        {
            return;
        }
        abortController.current?.abort();
        activeRequestId.current = undefined;
        abortController.current = undefined;
        setLoading(false);
        setMessages((current) => current.map((message) => message.state === 'loading' || message.state === 'streaming'
            ? {...message, content: message.content || 'Response cancelled.', state: 'abort', activity: undefined}
            : message));
    }, []);

    return {messages, loading, conversationId, submit, cancel, reset};
};
