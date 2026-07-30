import type {RouteHandler} from '../../core/types.ts';
import {actionRequestSchema} from '../../nlui/schemas.ts';
import {confirmNluiAction} from '../../nlui/tools.ts';

export const POST: RouteHandler = async ({req}) =>
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

    try
    {
        const execution = confirmNluiAction(parsed.data.actionId);
        return Response.json({block: execution.blocks[0]});
    }
    catch (error)
    {
        return Response.json({
            message: error instanceof Error ? error.message : 'The action failed'
        }, {status: 409});
    }
};
