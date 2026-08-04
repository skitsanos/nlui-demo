import {describe, expect, test} from 'bun:test';
import type {ChatStreamEvent} from '../nlui/types.ts';
import {ChatConfigurationError} from './openaiChat.ts';
import {
    GENERIC_PUBLIC_CHAT_ERROR,
    publicChatErrorMessage,
    publicChatStreamEvent
} from './publicChatStream.ts';

describe('public chat stream contract', () =>
{
    test('removes legacy tool events while retaining public activity events', () =>
    {
        expect(publicChatStreamEvent({type: 'tool.started', name: 'query_dataset'})).toBeUndefined();
        expect(publicChatStreamEvent({type: 'tool.completed', name: 'query_dataset'})).toBeUndefined();

        const event: ChatStreamEvent = {
            type: 'activity.updated',
            activity: {
                id: 'message-1:tool:1',
                kind: 'data',
                title: 'Checking the demo dataset',
                status: 'loading',
                receipt: true
            }
        };
        expect(publicChatStreamEvent(event)).toEqual(event);
    });

    test('allowlists only known configuration and cancellation messages', () =>
    {
        expect(publicChatErrorMessage(new ChatConfigurationError('OPENAI_API_KEY is not configured')))
            .toBe('OPENAI_API_KEY is not configured');
        expect(publicChatErrorMessage(new ChatConfigurationError('CHAT_MODEL is not configured')))
            .toBe('CHAT_MODEL is not configured');
        expect(publicChatErrorMessage(new DOMException('private abort details', 'AbortError')))
            .toBe('The response was cancelled');
        expect(publicChatErrorMessage(new ChatConfigurationError('private configuration details')))
            .toBe(GENERIC_PUBLIC_CHAT_ERROR);
    });

    test('replaces provider, SQL, tool, and prebuilt error diagnostics with one fallback', () =>
    {
        const diagnostics = [
            new Error('provider request failed for api-key-secret'),
            new Error('failed near SELECT * FROM private_table'),
            {message: 'tool execution returned private rows'}
        ];
        for (const diagnostic of diagnostics)
        {
            expect(publicChatErrorMessage(diagnostic)).toBe(GENERIC_PUBLIC_CHAT_ERROR);
        }

        expect(publicChatStreamEvent({
            type: 'error',
            message: 'provider failed near SELECT * FROM private_table'
        })).toEqual({type: 'error', message: GENERIC_PUBLIC_CHAT_ERROR});
    });
});
