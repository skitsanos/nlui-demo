import {expect, test} from 'bun:test';
import {toAgUiEvents} from './agUi.ts';

test('AG-UI projection retains application identity and never promotes internal tool/provider events', () =>
{
    const entry = {version: 1 as const, sequence: 2, requestId: 'owned-turn'};
    expect(toAgUiEvents('owned-thread', {...entry, event: {type: 'message.started', messageId: 'm'}})).toContainEqual(
        {type: 'RUN_STARTED', threadId: 'owned-thread', runId: 'owned-turn'});
    expect(toAgUiEvents('owned-thread', {...entry, event: {type: 'tool.started', name: 'private'}})).toEqual([]);
    const complete = toAgUiEvents('owned-thread', {...entry, event: {type: 'message.completed', messageId: 'm', responseId: 'provider-private'}});
    expect(complete.at(-1)).toEqual({type: 'RUN_FINISHED', threadId: 'owned-thread', runId: 'owned-turn'});
    expect(JSON.stringify(complete)).not.toContain('provider-private');
    expect(toAgUiEvents('owned-thread', {...entry, event: {type: 'error', message: 'Safe error'}})).toEqual([{type: 'RUN_ERROR', message: 'Safe error'}]);
});
