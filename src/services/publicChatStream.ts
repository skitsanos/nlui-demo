import type {ChatStreamEvent} from '../nlui/types.ts';

export type PublicChatStreamEvent = Exclude<
    ChatStreamEvent,
    {type: 'tool.started'} | {type: 'tool.completed'}
>;

export const GENERIC_PUBLIC_CHAT_ERROR = 'The assistant could not complete this response. Please try again.';

const CONFIGURATION_MESSAGES = new Set([
    'OPENAI_API_KEY is not configured',
    'CHAT_MODEL is not configured'
]);

const PUBLIC_ERROR_MESSAGES = new Set([
    ...CONFIGURATION_MESSAGES,
    'The response was cancelled',
    GENERIC_PUBLIC_CHAT_ERROR
]);

export const publicChatErrorMessage = (error: unknown): string =>
{
    if (!(error instanceof Error)) return GENERIC_PUBLIC_CHAT_ERROR;
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
    return event;
};
