import type {
    RouteContext,
    RouteMethod,
    RouteModule,
    RouteWebSocketHandler,
    SocketData
} from '@/core/types.ts';
import {ALLOWED_METHODS} from '@/core/types.ts';
import type Logger from '@/utils/logger.ts';
import {isDevelopment, routesDir} from '@/utils/runtime.ts';

const createResponse = (body = '', status = 200, headers: HeadersInit = {}): Response =>
    new Response(body, {status, headers});

const loadRouteModule = async (filePath: string): Promise<RouteModule> =>
    await import(filePath) as RouteModule;

const isRouteMethod = (method: string): method is RouteMethod =>
    ALLOWED_METHODS.includes(method as RouteMethod);

/**
 * Returns every method a route can serve, including HTTP's implicit HEAD support
 * for GET handlers.
 */
export const getAllowedMethods = (route: RouteModule): RouteMethod[] =>
{
    const explicit = ALLOWED_METHODS.filter((method) => route[method]);
    if (explicit.length > 0)
    {
        if (route.GET && !route.HEAD)
        {
            const getIndex = explicit.indexOf('GET');
            explicit.splice(getIndex + 1, 0, 'HEAD');
        }

        return explicit;
    }

    if (route.default)
    {
        return ALLOWED_METHODS;
    }

    // A websocket-only route answers GET solely as an upgrade handshake.
    return route.websocket ? ['GET'] : [];
};

const websocketHandlers: RouteWebSocketHandler = {
    open: (ws) =>
    {
        const websocketHandler = ws.data?.websocket;
        websocketHandler?.open?.(ws);
    },
    message: (ws, message) =>
    {
        const websocketHandler = ws.data?.websocket;
        websocketHandler?.message?.(ws, message as never);
    },
    close: (ws, code, reason) =>
    {
        const websocketHandler = ws.data?.websocket;
        websocketHandler?.close?.(ws, code, reason);
    },
    error: (ws, error) =>
    {
        const websocketHandler = ws.data?.websocket;
        websocketHandler?.error?.(ws, error);
    }
};

type FileRouter = Bun.FileSystemRouter;
type MatchedRoute = NonNullable<ReturnType<FileRouter['match']>>;

export type RouteDispatchResult = {
    matchedRoute: string;
    response?: Response;
    upgraded: boolean;
};

export type RouteDispatcher = {
    dispatch: (
        request: Request,
        server: Bun.Server<SocketData>
    ) => Promise<RouteDispatchResult | null>;
    preload: () => Promise<void>;
    websocket: RouteWebSocketHandler;
};

const selectHandler = (route: RouteModule, method: string) =>
{
    if (!isRouteMethod(method))
    {
        return route.default;
    }

    // RFC 9110 defines HEAD as GET without response content. Invoke an explicit
    // HEAD handler when present, otherwise reuse GET and let Bun suppress the body.
    const handler = method === 'HEAD'
        ? route.HEAD ?? route.GET
        : route[method];

    return handler ?? route.default;
};

const resolveRoute = async (
    request: Request,
    server: Bun.Server<SocketData>,
    matched: MatchedRoute
): Promise<Response | undefined> =>
{
    const route = await loadRouteModule(matched.filePath);
    const context: RouteContext = {
        req: request,
        pathname: matched.pathname,
        query: matched.query ?? {},
        params: matched.params ?? {},
        server
    };
    const method = request.method.toUpperCase();

    const isWebSocketUpgrade = request.headers.get('upgrade')?.toLowerCase() === 'websocket';
    if (isWebSocketUpgrade && method === 'GET' && route.websocket)
    {
        const upgraded = server.upgrade(request, {
            data: {
                websocket: route.websocket,
                pathname: context.pathname,
                query: context.query,
                params: context.params
            }
        });

        // Bun owns an upgraded socket, represented by an undefined response.
        return upgraded ? undefined : createResponse('WebSocket upgrade failed', 400);
    }

    const routeHandler = selectHandler(route, method);
    if (routeHandler)
    {
        return await routeHandler(context) ?? createResponse('', 204);
    }

    if (route.websocket && method === 'GET')
    {
        return createResponse('Upgrade Required', 426, {
            'Content-Type': 'text/plain',
            Upgrade: 'websocket',
            Connection: 'Upgrade'
        });
    }

    return createResponse(`Method ${method} Not Allowed`, 405, {
        'Content-Type': 'text/plain',
        Allow: getAllowedMethods(route).join(', ')
    });
};

export const createRouteDispatcher = (logger: Logger): RouteDispatcher =>
{
    const fileRouter = new Bun.FileSystemRouter({
        style: 'nextjs',
        dir: routesDir,
        fileExtensions: ['.ts', '.tsx']
    });

    const preload = async (): Promise<void> =>
    {
        const entries = Object.entries(fileRouter.routes);
        const failures: string[] = [];

        await Promise.all(entries.map(async ([routePath, filePath]) =>
        {
            try
            {
                const routeModule = await loadRouteModule(filePath);
                if (getAllowedMethods(routeModule).length === 0 && !routeModule.websocket)
                {
                    logger.warn(`Route ${routePath} exports no handler and will always 405`, {file: filePath});
                }
            }
            catch (error)
            {
                failures.push(routePath);
                logger.error(`Failed to load route ${routePath}`, {file: filePath, error});
            }
        }));

        if (failures.length > 0)
        {
            logger.fatal(`${failures.length} route(s) failed to load`, {routes: failures});
            process.exit(1);
        }

        logger.debug(`Loaded ${entries.length} route(s)`);
    };

    const dispatch = async (
        request: Request,
        server: Bun.Server<SocketData>
    ): Promise<RouteDispatchResult | null> =>
    {
        let matched = fileRouter.match(request);

        if (!matched && isDevelopment)
        {
            fileRouter.reload();
            matched = fileRouter.match(request);
        }

        if (!matched)
        {
            return null;
        }

        const response = await resolveRoute(request, server, matched);
        return {
            matchedRoute: matched.filePath,
            response,
            upgraded: response === undefined
        };
    };

    return {dispatch, preload, websocket: websocketHandlers};
};
