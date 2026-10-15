import config from '../core/configuration.ts';
import type {RouteHandler} from '../core/types.ts';
import {interactionCapabilities} from '../nlui/interactionCapabilities.ts';
import {chatRequestSchema} from '../nlui/schemas.ts';
import type {ChatStreamEvent} from '../nlui/types.ts';
import {abortable, createRequestDeadline, RequestBodyTooLargeError, RequestDeadlineError, readRequestJson } from '../server/requestDeadline.ts';
import {createConfiguredOpenAIChatRunner} from '../services/openaiChat.ts';
import type {OpenAIChatRunner} from '../services/openaiChatRunner.ts';
import {publicChatErrorMessage, publicChatStreamEvent} from '../services/publicChatStream.ts';
import {actionIntentFor, ownedHistory} from './history.ts';
import {conversationSession} from './session.ts';
import {ConversationAccessError, type ConversationStore, getConversationStore} from './store.ts';

export const createOwnedChatHandler = (options: {store?: ConversationStore; run?: OpenAIChatRunner;
    registry?: typeof interactionCapabilities; timeoutMs?: number; maximumBytes?: number} = {}): RouteHandler => async ({req, server}) =>
{
    const store = options.store ?? getConversationStore();
    const registry = options.registry ?? interactionCapabilities;
    const timeoutMs = options.timeoutMs ?? config.server.chatRequestTimeoutMs;
    const deadline = createRequestDeadline(req.signal, timeoutMs);
    let conversation = '';
    let requestId = '';
    let claimed = '';
    let started = false;
    try
    {
        const {owner, headers} = conversationSession(req, store);
        let body: unknown;
        try {body = await readRequestJson(req, deadline.signal, options.maximumBytes ?? config.server.maxRequestBodySize);}
        catch (error) {if (error instanceof SyntaxError) {deadline.dispose(); return Response.json({message: 'Expected a JSON request body'}, {status: 400});} throw error;}
        const validated = chatRequestSchema.safeParse(body);
        if (!validated.success) {deadline.dispose(); return Response.json({message: 'Invalid chat request'}, {status: 400});}
        const parsed = validated.data;
        conversation = parsed.conversationId;
        requestId = parsed.requestId ?? crypto.randomUUID();
        const status = store.begin(owner, conversation, requestId, parsed.input, parsed.previousResponseId);
        headers.set('Content-Type', 'application/x-ndjson; charset=utf-8');
        headers.set('X-Accel-Buffering', 'no');
        const encode = (event: ChatStreamEvent): Uint8Array => new TextEncoder().encode(`${JSON.stringify(event)}\n`);
        if (status === 'replay')
        {
            const replay = store.replay(owner, conversation, 0, requestId);
            const events = replay.events.filter(({event}) => event.type !== 'user.input').map(({event}) => JSON.stringify(event));
            if (replay.interrupted.includes(requestId)) events.push(JSON.stringify({type: 'error', message: 'The previous turn was interrupted. Send a new request to continue.'}));
            deadline.dispose();
            return new Response(`${events.join('\n')}\n`, {headers});
        }
        started = true;
        const request = {...parsed, requestId};
        if (request.input.type === 'ui_result')
        {
            request.input = {...request.input, values: registry.consume(conversation, request.input.interactionId, request.input.values)};
            claimed = request.input.interactionId;
        }
        const run = options.run ?? createConfiguredOpenAIChatRunner('control', undefined, registry, {
            history: ownedHistory(store.replay(owner, conversation).events, requestId),
            context: {ownerScope: `${owner}:${conversation}`, conversationId: conversation, actionIntent: actionIntentFor(request.input)}
        });
        server.timeout(req, Math.min(255, Math.max(1, Math.ceil(timeoutMs / 1000))));
        let disconnected = false;
        let completed = false;
        const stream = new ReadableStream<Uint8Array>({
            start(output)
            {
                const emit = (event: ChatStreamEvent): void =>
                {
                    deadline.check();
                    const publicEvent = publicChatStreamEvent(event.type === 'message.completed' ? {...event, responseId: requestId} : event);
                    if (!publicEvent) return;
                    store.append(conversation, requestId, publicEvent);
                    if (event.type === 'message.completed') completed = true;
                    if (!disconnected) output.enqueue(encode(publicEvent));
                };
                void abortable(() => run(request, emit, deadline.signal), deadline.signal).catch((error: unknown) =>
                {
                    if (!completed)
                    {
                        const event: ChatStreamEvent = {type: 'error', message: publicChatErrorMessage(error)};
                        store.append(conversation, requestId, event);
                        if (!disconnected) output.enqueue(encode(event));
                    }
                }).finally(() =>
                {
                    if (!completed)
                    {
                        store.interrupt(conversation, requestId);
                        if (claimed) registry.releaseSubmission(conversation, claimed);
                    }
                    deadline.dispose();
                    if (!disconnected) {try {output.close();} catch { /* Reader already closed. */ }}
                });
            },
            cancel() {disconnected = true; deadline.abort();}
        });
        return new Response(stream, {headers});
    }
    catch (error)
    {
        deadline.dispose();
        if (started) store.interrupt(conversation, requestId);
        const status = error instanceof ConversationAccessError ? error.status : error instanceof RequestBodyTooLargeError ? 413
            : error instanceof RequestDeadlineError || deadline.signal.aborted ? 408 : 400;
        return Response.json({message: error instanceof ConversationAccessError ? error.message
            : error instanceof RequestBodyTooLargeError ? 'Request body too large' : 'The chat request is invalid or unavailable.'}, {status});
    }
};
