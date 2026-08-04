import {describe, expect, test} from 'bun:test';
import {
    composeActivity,
    requestActivity,
    toolActivity,
    updateActivityStatus
} from './chatActivity.ts';

describe('server-owned chat activities', () =>
{
    test('uses stable message-scoped identifiers for request and compose activities', () =>
    {
        const request = requestActivity('message-7');
        const compose = composeActivity('message-7', 1);

        expect(request).toMatchObject({
            id: 'message-7:request',
            kind: 'request',
            status: 'loading',
            receipt: false
        });
        expect(compose).toMatchObject({
            id: 'message-7:compose:1',
            kind: 'compose',
            status: 'loading',
            receipt: false
        });
        expect(updateActivityStatus(request, 'success')).toEqual({...request, status: 'success'});
    });

    test('maps approved tools to sanitized receipt labels with application-owned IDs', () =>
    {
        expect(toolActivity('semantic_query', 'message-7', 1)).toEqual({
            id: 'message-7:tool:1',
            kind: 'data',
            title: 'Checking the demo dataset',
            description: 'Applying approved retail metrics and filters.',
            status: 'loading',
            receipt: true
        });
        expect(toolActivity('prepare_action', 'message-7', 2)).toMatchObject({
            id: 'message-7:tool:2',
            kind: 'action',
            title: 'Validating the requested action',
            receipt: true
        });
    });

    test('uses a generic fallback without reflecting an unknown tool name', () =>
    {
        const activity = toolActivity('raw_private_tool_name', 'message-7', 3);

        expect(activity).toMatchObject({
            id: 'message-7:tool:3',
            kind: 'action',
            title: 'Using an application capability',
            status: 'loading',
            receipt: true
        });
        expect(JSON.stringify(activity)).not.toContain('raw_private_tool_name');
    });
});
