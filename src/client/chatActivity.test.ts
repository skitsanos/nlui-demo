import {describe, expect, test} from 'bun:test';
import type {ChatActivity, NluiBlock} from '../nlui/types.ts';
import type {ChatMessage} from './chat.ts';
import {
    abortAssistantMessage,
    reduceAssistantEvent,
    selectActivityReceipt,
    selectCurrentActivity
} from './chatActivity.ts';

const activity = (overrides: Partial<ChatActivity> = {}): ChatActivity => ({
    id: 'request-1',
    kind: 'request',
    title: 'Understanding your request',
    status: 'loading',
    receipt: true,
    ...overrides
});

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
    id: 'assistant-1',
    role: 'assistant',
    content: '',
    blocks: [],
    activities: [],
    state: 'loading',
    ...overrides
});

const block = (type: 'table' | 'chart' | 'stats'): NluiBlock =>
{
    if (type === 'table')
    {
        return {id: 'table-1', type, columns: [], rows: [], rowKey: 'id'};
    }
    if (type === 'chart')
    {
        return {id: 'chart-1', type, variant: 'bar', categoryKey: 'name', valueKey: 'value', data: []};
    }
    return {id: 'stats-1', type, items: [{label: 'Customers', value: 42}]};
};

describe('assistant activity state', () =>
{
    test('updates an activity by stable id without duplicating or reordering it', () =>
    {
        const initial = message({activities: [
            activity(),
            activity({id: 'compose-1', kind: 'compose', title: 'Preparing the answer'})
        ]});
        const updated = reduceAssistantEvent(initial, {
            type: 'activity.updated',
            activity: activity({title: 'Request understood', status: 'success'})
        });

        expect(updated.activities).toHaveLength(2);
        expect(updated.activities.map(({id}) => id)).toEqual(['request-1', 'compose-1']);
        expect(updated.activities[0]).toEqual(activity({title: 'Request understood', status: 'success'}));
    });

    test('ignores legacy tool events for display state', () =>
    {
        const initial = message({activities: [activity()]});

        expect(reduceAssistantEvent(initial, {type: 'tool.started', name: 'query_dataset'})).toBe(initial);
        expect(reduceAssistantEvent(initial, {type: 'tool.completed', name: 'query_dataset'})).toBe(initial);
    });

    test('settles loading activities on completion and error', () =>
    {
        const initial = message({activities: [
            activity(),
            activity({id: 'data-1', kind: 'data', status: 'success'})
        ]});
        const completed = reduceAssistantEvent(initial, {
            type: 'message.completed',
            messageId: 'assistant-1',
            responseId: 'response-1'
        });
        const failed = reduceAssistantEvent(initial, {type: 'error', message: 'Dataset unavailable'});

        expect(completed.activities.map(({status}) => status)).toEqual(['success', 'success']);
        expect(failed.activities.map(({status}) => status)).toEqual(['error', 'success']);
        expect(failed.content).toBe('Dataset unavailable');
        expect(failed.state).toBe('error');
    });

    test('marks in-flight activities aborted when the response is cancelled', () =>
    {
        const aborted = abortAssistantMessage(message({activities: [activity()]}));

        expect(aborted.state).toBe('abort');
        expect(aborted.content).toBe('Response cancelled.');
        expect(aborted.activities[0]?.status).toBe('abort');
    });

    test('selects only the most recent loading activity for live status', () =>
    {
        const current = selectCurrentActivity(message({activities: [
            activity({status: 'success'}),
            activity({id: 'data-1', kind: 'data', title: 'Checking the dataset'}),
            activity({id: 'compose-1', kind: 'compose', title: 'Preparing the answer'})
        ]}));

        expect(current?.id).toBe('compose-1');
        expect(selectCurrentActivity(message({
            state: 'complete',
            activities: [activity()]
        }))).toBeUndefined();
    });
});

describe('activity receipt selection', () =>
{
    test('omits a receipt for simple prose and a single scalar metric', () =>
    {
        const oneActivity = [activity({status: 'success'})];

        expect(selectActivityReceipt(message({state: 'complete', activities: oneActivity}))).toEqual([]);
        expect(selectActivityReceipt(message({
            state: 'complete',
            activities: oneActivity,
            blocks: [block('stats')]
        }))).toEqual([]);
    });

    test('keeps a receipt for table and chart artifacts', () =>
    {
        const oneActivity = [activity({kind: 'data', status: 'success'})];

        expect(selectActivityReceipt(message({
            state: 'complete', activities: oneActivity, blocks: [block('table')]
        }))).toEqual(oneActivity);
        expect(selectActivityReceipt(message({
            state: 'complete', activities: oneActivity, blocks: [block('chart')]
        }))).toEqual(oneActivity);
    });

    test('keeps multi-step, action, error, and abort receipts', () =>
    {
        const multiStep = [
            activity({status: 'success'}),
            activity({id: 'compose-1', kind: 'compose', status: 'success'})
        ];
        const action = [activity({kind: 'action', status: 'success', receipt: false})];
        const failed = [activity({status: 'error', receipt: false})];
        const aborted = [activity({status: 'abort', receipt: false})];

        expect(selectActivityReceipt(message({state: 'complete', activities: multiStep}))).toEqual(multiStep);
        expect(selectActivityReceipt(message({state: 'complete', activities: action}))).toEqual(action);
        expect(selectActivityReceipt(message({state: 'error', activities: failed}))).toEqual(failed);
        expect(selectActivityReceipt(message({state: 'abort', activities: aborted}))).toEqual(aborted);
    });

    test('never shows a completed receipt while the response is still active', () =>
    {
        const activities = [
            activity({status: 'success'}),
            activity({id: 'data-1', kind: 'data', status: 'success'})
        ];

        expect(selectActivityReceipt(message({state: 'streaming', activities}))).toEqual([]);
    });
});
