import type {RouteHandler} from '../../core/types.ts';
import {
    InteractionCapabilityError,
    type InteractionCapabilityRegistry,
    interactionCapabilities
} from '../../nlui/interactionCapabilities.ts';
import {actionRequestSchema} from '../../nlui/schemas.ts';
import {confirmNluiAction} from '../../nlui/tools.ts';
import type {ToolExecution} from '../../nlui/toolTypes.ts';

interface ActionRouteDependencies
{
    registry: InteractionCapabilityRegistry;
    confirmAction: (actionId: string) => ToolExecution;
}

export const createActionPostHandler = ({registry, confirmAction}: ActionRouteDependencies): RouteHandler => async ({req}) =>
{
    let body: unknown;
    try
    {
        body = await req.json();
    }
    catch
    {
        return Response.json({message: 'Expected a JSON request body'}, {status: 400});
    }

    const parsed = actionRequestSchema.safeParse(body);
    if (!parsed.success)
    {
        return Response.json({message: 'Invalid action request'}, {status: 400});
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
        if (block?.type !== 'result')
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
        return Response.json({
            message: error instanceof InteractionCapabilityError
                ? error.message
                : error instanceof Error ? error.message : 'The action failed'
        }, {status: error instanceof InteractionCapabilityError ? 400 : 409});
    }
};

export const POST = createActionPostHandler({
    registry: interactionCapabilities,
    confirmAction: confirmNluiAction
});
