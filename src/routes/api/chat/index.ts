import type {RouteHandler} from '../../../core/types.ts';
import {ConversationStateError, conversationStates} from '../../../nlui/conversationState.ts';
import {InteractionCapabilityError, interactionCapabilities} from '../../../nlui/interactionCapabilities.ts';
import {chatRequestSchema} from '../../../nlui/schemas.ts';
import type {ChatStreamEvent} from '../../../nlui/types.ts';
import {ChatConfigurationError, runOpenAIChat} from '../../../services/openaiChat.ts';

const encoder = new TextEncoder();

const errorMessage = (error: unknown): string =>
{
    if (error instanceof ChatConfigurationError)
    {
        return error.message;
    }
    if (error instanceof Error && error.name === 'AbortError')
    {
        return 'The response was cancelled';
    }
    return error instanceof Error ? error.message : 'The chat request failed';
};

export const POST: RouteHandler = async ({req, server}) =>
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

    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success)
    {
        return Response.json({
            message: 'Invalid chat request',
            issues: parsed.error.issues.map(({path, message}) => ({path, message}))
        }, {status: 400});
    }

    let request = parsed.data;
    let claimedInteraction: {conversationId: string; interactionId: string} | undefined;
    try
    {
        conversationStates.begin(request.conversationId, request.previousResponseId);
    }
    catch (error)
    {
        return Response.json({
            message: error instanceof ConversationStateError ? error.message : 'The conversation could not be started'
        }, {status: 409});
    }
    if (request.input.type === 'ui_result')
    {
        const interactionId = request.input.interactionId;
        try
        {
            const values = interactionCapabilities.consume(
                request.conversationId,
                interactionId,
                request.input.values
            );
            request = {...request, input: {...request.input, values}};
            claimedInteraction = {
                conversationId: request.conversationId,
                interactionId
            };
        }
        catch (error)
        {
            conversationStates.release(request.conversationId);
            if (error instanceof InteractionCapabilityError)
            {
                return Response.json({message: error.message}, {status: 400});
            }
            throw error;
        }
    }

    // LLM calls may pause while tools execute; keep only this streaming request alive.
    server.timeout(req, 0);
    const controller = new AbortController();
    req.signal.addEventListener('abort', () => controller.abort(), {once: true});

    const stream = new ReadableStream<Uint8Array>({
        start(output)
        {
            const emit = (event: ChatStreamEvent): void =>
            {
                if (!controller.signal.aborted)
                {
                    output.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
                }
            };

            void runOpenAIChat(request, emit, controller.signal)
                .then((result) => conversationStates.complete(request.conversationId, result.responseId))
                .catch((error: unknown) =>
                {
                    conversationStates.release(request.conversationId);
                    if (claimedInteraction)
                    {
                        interactionCapabilities.releaseSubmission(
                            claimedInteraction.conversationId,
                            claimedInteraction.interactionId
                        );
                    }
                    if (!controller.signal.aborted)
                    {
                        emit({type: 'error', message: errorMessage(error)});
                    }
                })
                .finally(() =>
                {
                    if (!controller.signal.aborted)
                    {
                        output.close();
                    }
                });
        },
        cancel()
        {
            controller.abort();
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'X-Accel-Buffering': 'no'
        }
    });
};
