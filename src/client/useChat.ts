import {useCallback, useEffect, useRef, useState} from 'react';
import type {ChatInput, ChatStreamEvent} from '../nlui/types.ts';
import {type ChatMessage, streamChat} from './chat.ts';
import {abortAssistantMessage, reduceAssistantEvent} from './chatActivity.ts';
import type {AnalysisSubmission} from './components/AnalysisControls.tsx';
import {type ControlState, readConversation, replayMessages} from './conversationReplay.ts';
import {createClientId} from './id.ts';

const rememberedConversation = (): string =>
{
    try {return localStorage.getItem('nlui.conversation') ?? createClientId('conversation');}
    catch {return createClientId('conversation');}
};

export const useChat = () =>
{
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState(rememberedConversation);
    const [states, setStates] = useState<Record<string, ControlState>>({});
    const [initializing, setInitializing] = useState(true);
    const [historyError, setHistoryError] = useState<string>();
    const previousResponseId = useRef<string | undefined>(undefined);
    const abortController = useRef<AbortController | undefined>(undefined);
    const activeRequestId = useRef<string | undefined>(undefined);
    const initialized = useRef(false);

    useEffect(() =>
    {
        try {localStorage.setItem('nlui.conversation', conversationId);} catch { /* Private-browser storage may be unavailable. */ }
        if (initialized.current) {setInitializing(false); return;}
        const controller = new AbortController();
        void readConversation(conversationId, controller.signal).then((snapshot) =>
        {
            if (controller.signal.aborted) return;
            initialized.current = true;
            if (snapshot)
            {
                setMessages(replayMessages(snapshot));
                setStates(snapshot.states);
                previousResponseId.current = snapshot.head;
                if (snapshot.running) setHistoryError('A response is still running. Reload shortly to reconcile it; do not resubmit actions.');
            }
            else setConversationId(createClientId('conversation'));
        }).catch(() => {if (!controller.signal.aborted) setHistoryError('History could not be restored. Reload before continuing.');})
            .finally(() => {if (!controller.signal.aborted) setInitializing(false);});
        return () => controller.abort();
    }, [conversationId]);

    const updateAssistant = useCallback((id: string, event: ChatStreamEvent): void =>
    {
        setMessages((current) => current.map((message) =>
        {
            if (message.id !== id)
            {
                return message;
            }

            return reduceAssistantEvent(message, event);
        }));
    }, []);

    const submit = useCallback(async (input: ChatInput, displayText: string): Promise<boolean> =>
    {
        if (activeRequestId.current || initializing || historyError)
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
            {id: createClientId('user'), role: 'user', content: displayText, blocks: [], activities: [], state: 'complete'},
            {id: assistantId, role: 'assistant', content: '', blocks: [], activities: [], state: 'loading'}
        ]);

        let completed = false;
        try
        {
            await streamChat({
                conversationId,
                requestId,
                input,
                previousResponseId: previousResponseId.current,
                signal: controller.signal,
                onEvent: (event) =>
                {
                    if (controller.signal.aborted || activeRequestId.current !== requestId) return;
                    updateAssistant(assistantId, event);
                    if (event.type === 'message.completed')
                    {
                        previousResponseId.current = event.responseId;
                    }
                }
            });
            completed = !controller.signal.aborted && activeRequestId.current === requestId;
            const snapshot = await readConversation(conversationId, controller.signal);
            if (snapshot) setStates(snapshot.states);
        }
        catch (error)
        {
            if (!controller.signal.aborted)
            {
                try
                {
                    const snapshot = await readConversation(conversationId, controller.signal);
                    if (snapshot)
                    {
                        setMessages(replayMessages(snapshot)); setStates(snapshot.states); previousResponseId.current = snapshot.head;
                        completed = snapshot.head === requestId;
                        if (snapshot.running) setHistoryError('A response is still running. Reload shortly to reconcile it; do not resubmit actions.');
                    }
                    else updateAssistant(assistantId, {type: 'error', message: 'This session could not restore the response. Reload or start a new conversation.'});
                }
                catch {updateAssistant(assistantId, {type: 'error', message: error instanceof Error ? error.message : 'The request failed'});}
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
    }, [conversationId, updateAssistant, initializing, historyError]);

    const reset = useCallback((): void =>
    {
        abortController.current?.abort();
        activeRequestId.current = undefined;
        abortController.current = undefined;
        previousResponseId.current = undefined;
        setConversationId(createClientId('conversation'));
        setMessages([]);
        setStates({});
        setHistoryError(undefined);
        setInitializing(false);
        initialized.current = true;
        setLoading(false);
    }, []);

    const analyze = useCallback(async (input: AnalysisSubmission): Promise<boolean> =>
    {
        if (activeRequestId.current || initializing || historyError) return false;
        const id = createClientId('analysis');
        const controller = new AbortController();
        activeRequestId.current = id; abortController.current = controller; setLoading(true);
        try
        {
            const response = await fetch('/api/analysis', {method: 'POST', signal: controller.signal,
                headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...input, conversationId,
                    requestId: id, previousResponseId: previousResponseId.current})});
            if (!response.ok) return false;
            const snapshot = await readConversation(conversationId, controller.signal);
            if (snapshot) {setMessages(replayMessages(snapshot)); setStates(snapshot.states); previousResponseId.current = snapshot.head;}
            return true;
        }
        catch {return false;}
        finally {if (activeRequestId.current === id) {activeRequestId.current = undefined; abortController.current = undefined; setLoading(false);}}
    }, [conversationId, initializing, historyError]);

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
        setMessages((current) => current.map(abortAssistantMessage));
    }, []);

    return {messages, loading: loading || initializing, conversationId, states, historyError, submit, analyze, cancel, reset};
};
