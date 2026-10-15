import {describe, expect, test} from 'bun:test';
import type {ChatStreamEvent} from '../nlui/types.ts';
import {ChatConfigurationError} from './openaiChat.ts';
import {
    GENERIC_PUBLIC_CHAT_ERROR,
    PUBLIC_CHAT_EVENT_TYPES,
    publicChatErrorMessage,
    publicChatStreamEvent
} from './publicChatStream.ts';

describe('public chat stream contract', () =>
{
    test('documentation enumerates exactly the public events and its examples match the actual catalog', async () =>
    {
        const text = await Bun.file(new URL('../../public/docs/activity-protocol.md', import.meta.url)).text();
        const documented = [...text.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]);
        expect(documented).toEqual([...PUBLIC_CHAT_EVENT_TYPES]);
        const examples = text.match(/```ndjson\n([\s\S]+?)\n```/)![1]!.split('\n').map((line) => JSON.parse(line));
        for (const example of examples)
        {
            expect(publicChatStreamEvent(example)).toEqual(example);
            expect(Object.keys(example.activity).sort()).toEqual(['id', 'kind', 'title', 'description', 'status', 'receipt'].sort());
            expect(JSON.stringify(example)).not.toMatch(/SELECT|call_id|model|arguments|reasoning|resp_/);
        }
        expect(text).toContain('not SSE');
        expect(text).toContain('no provider response ID crosses this route');
        expect(text).toContain('Repeated identical requests replay persisted events');
        expect(text).toContain('another session receives 404');
        expect(text).toContain('not SSE or complete AG-UI event-family conformance');
    });

    test('projects public activity fields instead of forwarding unexpected internal diagnostics', () =>
    {
        const event = {type: 'activity.updated', provider: 'private', activity: {id: 'one', kind: 'data', title: 'Checking',
            status: 'loading', receipt: true, arguments: {sql: 'private'}, reasoning: 'private'}};
        expect(publicChatStreamEvent(event as ChatStreamEvent)).toEqual({type: 'activity.updated', activity: {
            id: 'one', kind: 'data', title: 'Checking', status: 'loading', receipt: true
        }});
        expect(publicChatStreamEvent({type: 'unknown', private: 'not public'} as unknown as ChatStreamEvent)).toBeUndefined();
    });
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
