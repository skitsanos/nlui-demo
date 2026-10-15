import type {RouteSocket, RouteWebSocketHandler} from '../core/types.ts';

export const trackWebSockets = (handlers: RouteWebSocketHandler) =>
{
    const sockets = new Set<RouteSocket>();
    return {
        handlers: {
            ...handlers,
            open: (socket: RouteSocket) =>
            {
                sockets.add(socket);
                return handlers.open?.(socket);
            },
            close: (socket: RouteSocket, code: number, reason: string) =>
            {
                sockets.delete(socket);
                return handlers.close?.(socket, code, reason);
            }
        } satisfies RouteWebSocketHandler,
        close: () =>
        {
            for (const socket of sockets) socket.close(1012, 'Server restarting');
        }
    };
};
