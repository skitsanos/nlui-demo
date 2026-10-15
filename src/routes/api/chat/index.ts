import {createOwnedChatHandler} from '../../../conversations/chat.ts';
import config from '../../../core/configuration.ts';
import type {RouteHandler} from '../../../core/types.ts';
import {ConversationStateError, type ConversationStateRegistry, conversationStates} from '../../../nlui/conversationState.ts';
import {InteractionCapabilityError, type InteractionCapabilityRegistry, interactionCapabilities} from '../../../nlui/interactionCapabilities.ts';
import {chatRequestSchema} from '../../../nlui/schemas.ts';
import type {ChatStreamEvent} from '../../../nlui/types.ts';
import {abortable, createRequestDeadline, RequestBodyTooLargeError, RequestDeadlineError, readRequestJson} from '../../../server/requestDeadline.ts';
import {type OpenAIChatRunner, runOpenAIChat} from '../../../services/openaiChat.ts';
import {publicChatErrorMessage, publicChatStreamEvent} from '../../../services/publicChatStream.ts';

const encoder = new TextEncoder();

export const createChatHandler = ({
    runChat = runOpenAIChat,
    states = conversationStates,
    capabilities = interactionCapabilities,
    timeoutMs = config.server.chatRequestTimeoutMs
}: {
    runChat?: OpenAIChatRunner;
    states?: ConversationStateRegistry;
    capabilities?: InteractionCapabilityRegistry;
    timeoutMs?: number;
} = {}): RouteHandler => async ({req, server}) =>
{
    const deadline = createRequestDeadline(req.signal, timeoutMs);
    const earlyResponse = (message: string, status: number): Response =>
    {
        deadline.dispose();
        return Response.json({message}, {status});
    };
    let body: unknown;
    try
    {
        body = await abortable(() => readRequestJson(req, deadline.signal, config.server.maxRequestBodySize), deadline.signal);
        deadline.check();
    }
    catch (error)
    {
        if (error instanceof RequestBodyTooLargeError) return earlyResponse('Request body too large', 413);
        return earlyResponse(deadline.signal.aborted
            ? publicChatErrorMessage(deadline.signal.reason)
            : 'Expected a JSON request body', deadline.signal.aborted ? 408 : 400);
    }

    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success)
    {
        deadline.dispose();
        return Response.json({
            message: 'Invalid chat request',
            issues: parsed.error.issues.map(({path, message}) => ({path, message}))
        }, {status: 400});
    }

    let request = parsed.data;
    let claimedInteraction: {conversationId: string; interactionId: string} | undefined;
    try
    {
        deadline.check();
        states.begin(request.conversationId, request.previousResponseId);
    }
    catch (error)
    {
        return earlyResponse(error instanceof ConversationStateError ? error.message : publicChatErrorMessage(error),
            error instanceof RequestDeadlineError ? 408 : 409);
    }
    if (request.input.type === 'ui_result')
    {
        const interactionId = request.input.interactionId;
        try
        {
            const values = capabilities.consume(request.conversationId, interactionId, request.input.values);
            request = {...request, input: {...request.input, values}};
            claimedInteraction = {conversationId: request.conversationId, interactionId};
        }
        catch (error)
        {
            states.release(request.conversationId);
            deadline.dispose();
            if (error instanceof InteractionCapabilityError)
            {
                return Response.json({message: error.message}, {status: 400});
            }
            throw error;
        }
    }

    // Keep a finite transport idle bound too, including while a slow client drains output.
    server.timeout(req, Math.min(255, Math.max(1, Math.ceil(timeoutMs / 1_000))));
    let closed = false;
    const stream = new ReadableStream<Uint8Array>({
        start(output)
        {
            const publish = (event: ChatStreamEvent): void =>
            {
                if (closed) return;
                const publicEvent = publicChatStreamEvent(event);
                if (!publicEvent) return;
                try {output.enqueue(encoder.encode(`${JSON.stringify(publicEvent)}\n`));}
                catch {closed = true; deadline.abort();}
            };
            const emit = (event: ChatStreamEvent): void =>
            {
                if (closed) return;
                deadline.check();
                publish(event);
            };

            void abortable(() => runChat(request, emit, deadline.signal), deadline.signal)
                .then((result) =>
                {
                    deadline.check();
                    states.complete(request.conversationId, result.responseId);
                })
                .catch((error: unknown) =>
                {
                    states.release(request.conversationId);
                    if (claimedInteraction)
                    {
                        capabilities.releaseSubmission(claimedInteraction.conversationId, claimedInteraction.interactionId);
                    }
                    if (!deadline.signal.aborted || deadline.signal.reason instanceof RequestDeadlineError)
                    {
                        publish({type: 'error', message: publicChatErrorMessage(
                            deadline.signal.aborted ? deadline.signal.reason : error
                        )});
                    }
                })
                .finally(() =>
                {
                    deadline.dispose();
                    if (!closed)
                    {
                        closed = true;
                        try {output.close();} catch { /* A disconnected reader already owns closure. */ }
                    }
                });
        },
        cancel()
        {
            closed = true;
            deadline.abort();
            deadline.dispose();
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

export const POST = createOwnedChatHandler();
