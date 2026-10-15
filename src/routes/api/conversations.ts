import {AG_UI_ADAPTER_VERSION, toAgUiEvents} from '../../conversations/agUi.ts';
import {conversationSession} from '../../conversations/session.ts';
import {ConversationAccessError, getConversationStore} from '../../conversations/store.ts';
import type {RouteHandler} from '../../core/types.ts';
import {interactionCapabilities} from '../../nlui/interactionCapabilities.ts';

export const GET: RouteHandler = ({req}) =>
{
    try
    {
        const store = getConversationStore();
        const {owner, headers} = conversationSession(req, store);
        const url = new URL(req.url);
        const conversationId = url.searchParams.get('conversationId');
        if (!conversationId) return Response.json({version: 1, events: [], interrupted: [], running: false, states: {}}, {headers});
        const cursor = Number(url.searchParams.get('after') ?? 0);
        if (!Number.isSafeInteger(cursor) || cursor < 0 || conversationId.length > 120) return Response.json({message: 'Invalid replay cursor.'}, {status: 400, headers});
        try
        {
            const replay = store.replay(owner, conversationId, cursor);
            return Response.json(url.searchParams.get('transport') === 'ag-ui'
                ? {adapterVersion: AG_UI_ADAPTER_VERSION, nextCursor: replay.nextCursor, hasMore: replay.hasMore, interrupted: replay.interrupted,
                    events: replay.events.flatMap((entry) => toAgUiEvents(conversationId, entry))}
                : {...replay, states: interactionCapabilities.states(conversationId)}, {headers});
        }
        catch (error)
        {
            if (error instanceof ConversationAccessError && error.status === 404) return Response.json({message: error.message}, {status: 404, headers});
            throw error;
        }
    }
    catch (error)
    {
        return Response.json({message: 'Conversation not found.'}, {status: error instanceof ConversationAccessError ? error.status : 500});
    }
};
