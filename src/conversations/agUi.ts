import {inputText} from './history.ts';
import type {StoredEvent} from './store.ts';

// A bounded transport projection: domain blocks/actions never depend on AG-UI.
// No reasoning, raw tool arguments, SQL or provider continuation IDs are replayed.
export const AG_UI_ADAPTER_VERSION = 1;
export const toAgUiEvents = (conversation: string, entry: StoredEvent): Array<Record<string, unknown>> =>
{
    const {event, requestId, sequence} = entry;
    const messageId = `${requestId}:assistant`;
    const base = {threadId: conversation, runId: requestId};
    switch (event.type)
    {
        case 'user.input': return [
            {type: 'TEXT_MESSAGE_START', messageId: `${requestId}:user`, role: 'user'},
            {type: 'TEXT_MESSAGE_CONTENT', messageId: `${requestId}:user`, delta: inputText(event.input)},
            {type: 'TEXT_MESSAGE_END', messageId: `${requestId}:user`}
        ];
        case 'message.started': return [{type: 'RUN_STARTED', ...base}, {type: 'TEXT_MESSAGE_START', messageId, role: 'assistant'}];
        case 'activity.updated': return [{type: 'CUSTOM', name: 'nlui.activity', value: {sequence, activity: event.activity}}];
        case 'text.delta': return [{type: 'TEXT_MESSAGE_CONTENT', messageId, delta: event.delta}];
        case 'ui.block': return [{type: 'CUSTOM', name: 'nlui.block', value: {sequence, block: event.block}}];
        case 'message.completed': return [{type: 'TEXT_MESSAGE_END', messageId}, {type: 'RUN_FINISHED', ...base}];
        case 'error': return [{type: 'RUN_ERROR', message: event.message}];
        default: return [];
    }
};
