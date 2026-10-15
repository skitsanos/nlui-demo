import {conversationSession} from '../../conversations/session.ts';
import {ConversationAccessError, getConversationStore} from '../../conversations/store.ts';
import type {RouteHandler} from '../../core/types.ts';
import {actionSuccessSchema} from '../../nlui/actionResponse.ts';
import {
    type InteractionCapabilityRegistry,
    interactionCapabilities
} from '../../nlui/interactionCapabilities.ts';
import {actionRequestSchema} from '../../nlui/schemas.ts';
import {confirmNluiAction} from '../../nlui/tools.ts';
import type {ToolExecution} from '../../nlui/toolTypes.ts';
import {publicActionError, reportUnexpectedActionError} from '../../services/publicActionError.ts';

interface ActionRouteDependencies
{
    registry: InteractionCapabilityRegistry;
    confirmAction: (actionId: string) => ToolExecution;
    reportError?: (error: unknown) => void;
}

export const createActionPostHandler = ({
    registry, confirmAction, reportError = reportUnexpectedActionError
}: ActionRouteDependencies): RouteHandler => async ({req}) =>
{
    let body: unknown;
    try
    {
        body = await req.json();
    }
    catch
    {
        return Response.json({message: 'Expected a JSON request body', outcome: 'unavailable', retryable: false}, {status: 400});
    }

    const parsed = actionRequestSchema.safeParse(body);
    if (!parsed.success)
    {
        return Response.json({message: 'Invalid action request', outcome: 'unavailable', retryable: false}, {status: 400});
    }

    let reserved = false;
    try
    {
        const reservation = registry.beginConfirmation(
            parsed.data.conversationId,
            parsed.data.interactionId,
            parsed.data.actionId
        );
        if (reservation.status === 'completed')
        {
            return Response.json({block: reservation.block, replayed: true});
        }
        reserved = true;
        const execution = confirmAction(parsed.data.actionId);
        const block = execution.blocks[0];
        if (block?.type !== 'result' || !actionSuccessSchema.safeParse({block}).success)
        {
            throw new Error('The completed action did not return a result block');
        }
        registry.completeConfirmation(
            parsed.data.conversationId,
            parsed.data.interactionId,
            parsed.data.actionId,
            block
        );
        return Response.json({block});
    }
    catch (error)
    {
        if (reserved)
        {
            registry.releaseConfirmation(parsed.data.interactionId);
        }
        const failure = publicActionError(error);
        if (failure.status === 500)
        {
            // A diagnostic sink must not break the public error boundary.
            try {reportError(error);} catch { /* Preserve the generic response. */ }
        }
        const {status, ...payload} = failure;
        return Response.json(payload, {status});
    }
};

export const POST: RouteHandler = async (context) =>
{
    let raw: unknown;
    try {raw = await context.req.clone().json();}
    catch {return Response.json({message: 'Expected a JSON request body', outcome: 'unavailable', retryable: false}, {status: 400});}
    const parsed = actionRequestSchema.safeParse(raw);
    if (!parsed.success) return Response.json({message: 'Invalid action request', outcome: 'unavailable', retryable: false}, {status: 400});
    try
    {
        const body = parsed.data;
        const {owner} = conversationSession(context.req);
        getConversationStore().assertOwner(owner, body.conversationId);
        return await createActionPostHandler({registry: interactionCapabilities,
            confirmAction: (id) => confirmNluiAction(id, `${owner}:${body.conversationId}`)})(context);
    }
    catch (error)
    {
        return Response.json({message: 'This action is unavailable.', outcome: 'unavailable', retryable: false}, {
            status: error instanceof ConversationAccessError ? error.status : 400
        });
    }
};
