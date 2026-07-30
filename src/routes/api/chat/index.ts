import type {RouteHandler} from '../../../core/types.ts';
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

            void runOpenAIChat(parsed.data, emit, controller.signal)
                .catch((error: unknown) =>
                {
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
