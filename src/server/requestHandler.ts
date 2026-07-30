import config from '@/core/configuration.ts';
import type {SocketData} from '@/core/types.ts';
import {applyCorsHeaders, handleCors} from '@/utils/cors.ts';
import type Logger from '@/utils/logger.ts';
import {publicDir} from '@/utils/runtime.ts';
import {serveStatic} from '@/utils/staticFiles.ts';
import type {RouteDispatcher} from './routing.ts';

const createResponse = (body = '', status = 200, headers: HeadersInit = {}): Response =>
    new Response(body, {status, headers});

const getClientIp = (request: Request, server: Bun.Server<SocketData>): string =>
{
    if (config.server.trustProxy)
    {
        const forwardedIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
        const realIp = forwardedIp || request.headers.get('x-real-ip');
        if (realIp)
        {
            return realIp;
        }
    }

    return server.requestIP(request)?.address ?? 'unknown';
};

const isWellFormedPath = (pathname: string): boolean =>
{
    try
    {
        decodeURIComponent(pathname);
        return true;
    }
    catch
    {
        return false;
    }
};

const toMs = (nanoseconds: number): number => nanoseconds / 1_000_000;

type RequestHandlerOptions = {
    dispatcher: RouteDispatcher;
    logger: Logger;
    loggerHttp: Logger;
    serverName?: string;
};

export const createRequestHandler = ({
    dispatcher,
    logger,
    loggerHttp,
    serverName
}: RequestHandlerOptions) => async (
    request: Request,
    server: Bun.Server<SocketData>
): Promise<Response | undefined> =>
{
    const start = Bun.nanoseconds();
    const requestUrl = new URL(request.url);
    const clientIp = getClientIp(request, server);

    const preflightResponse = handleCors(request, config.server.cors);
    if (preflightResponse)
    {
        return preflightResponse;
    }

    let matchedRoute: string | null = null;
    let response: Response | undefined;
    let upgraded = false;

    try
    {
        if (!isWellFormedPath(requestUrl.pathname))
        {
            response = createResponse('Bad Request', 400, {'Content-Type': 'text/plain'});
        }
        else if (request.method === 'GET' || request.method === 'HEAD')
        {
            const staticResponse = await serveStatic(
                requestUrl.pathname,
                publicDir,
                request.headers.get('if-none-match')
            );

            if (staticResponse)
            {
                matchedRoute = 'static';
                response = staticResponse;
            }
        }

        if (!response)
        {
            const result = await dispatcher.dispatch(request, server);
            if (!result)
            {
                response = createResponse('Not Found', 404, {'Content-Type': 'text/plain'});
            }
            else
            {
                matchedRoute = result.matchedRoute;
                response = result.response;
                upgraded = result.upgraded;
            }
        }
    }
    catch (error)
    {
        logger.error('Unhandled request error', {
            method: request.method,
            path: requestUrl.pathname,
            error
        });
        response = createResponse('Internal Server Error', 500);
    }

    const duration = toMs(Bun.nanoseconds() - start);
    if (upgraded)
    {
        loggerHttp.debug(`WS ${requestUrl.pathname}`, {
            status: 101,
            clientIp,
            route: matchedRoute
        });
        return undefined;
    }

    const finalResponse = response ?? createResponse('Internal Server Error', 500);
    finalResponse.headers.set('X-Response-Time', `${duration.toFixed(3)}ms`);
    finalResponse.headers.set('Server', serverName || config.serviceName || 'bun-service');
    applyCorsHeaders(finalResponse, request, config.server.cors);

    const logLevel = finalResponse.status >= 500 ? 'error'
        : finalResponse.status >= 400 ? 'warn'
            : 'trace';
    loggerHttp[logLevel](`${request.method} ${requestUrl.pathname}`, {
        status: finalResponse.status,
        durationMs: duration.toFixed(3),
        clientIp,
        route: matchedRoute
    });

    return finalResponse;
};
