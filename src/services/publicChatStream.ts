import type {ChatStreamEvent} from '../nlui/types.ts';
import {REQUEST_TIMEOUT_MESSAGE, RequestDeadlineError} from '../server/requestDeadline.ts';

export type PublicChatStreamEvent = Exclude<
    ChatStreamEvent,
    {type: 'tool.started'} | {type: 'tool.completed'}
>;

export const PUBLIC_CHAT_EVENT_TYPES = ['message.started', 'activity.updated', 'text.delta', 'ui.block', 'message.completed', 'error'] as const;

export const GENERIC_PUBLIC_CHAT_ERROR = 'The assistant could not complete this response. Please try again.';

const CONFIGURATION_MESSAGES = new Set([
    'OPENAI_API_KEY is not configured',
    'CHAT_MODEL is not configured'
]);

const PUBLIC_ERROR_MESSAGES = new Set([
    ...CONFIGURATION_MESSAGES,
    'The response was cancelled',
    REQUEST_TIMEOUT_MESSAGE,
    GENERIC_PUBLIC_CHAT_ERROR
]);

export const publicChatErrorMessage = (error: unknown): string =>
{
    if (!(error instanceof Error)) return GENERIC_PUBLIC_CHAT_ERROR;
    if (error instanceof RequestDeadlineError) return REQUEST_TIMEOUT_MESSAGE;
    if (error.name === 'AbortError') return 'The response was cancelled';
    if (error.name === 'ChatConfigurationError' && CONFIGURATION_MESSAGES.has(error.message))
    {
        return error.message;
    }
    return GENERIC_PUBLIC_CHAT_ERROR;
};

export const publicChatStreamEvent = (event: ChatStreamEvent): PublicChatStreamEvent | undefined =>
{
    if (event.type === 'tool.started' || event.type === 'tool.completed') return undefined;
    if (event.type === 'error')
    {
        return {
            type: 'error',
            message: PUBLIC_ERROR_MESSAGES.has(event.message) ? event.message : GENERIC_PUBLIC_CHAT_ERROR
        };
    }
    switch (event.type)
    {
        case 'message.started': return {type: event.type, messageId: event.messageId};
        case 'activity.updated':
        {
            const {id, kind, title, description, status, receipt} = event.activity;
            return {type: event.type, activity: {id, kind, title, ...description !== undefined && {description}, status, receipt}};
        }
        case 'text.delta': return {type: event.type, delta: event.delta};
        case 'ui.block': return {type: event.type, block: event.block};
        case 'message.completed': return {type: event.type, messageId: event.messageId, responseId: event.responseId};
        default: return undefined;
    }
};
