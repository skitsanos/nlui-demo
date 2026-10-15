import type {SocketData} from '../../src/core/types.ts';
import {ActionDomainError} from '../../src/data/actionErrors.ts';
import {InteractionCapabilityRegistry} from '../../src/nlui/interactionCapabilities.ts';
import {createActionPostHandler} from '../../src/routes/api/actions.ts';
import {createChatHandler} from '../../src/routes/api/chat/index.ts';
import {installShutdownHandlers} from '../../src/server/lifecycle.ts';
import {trackWebSockets} from '../../src/server/socketLifecycle.ts';
import Logger, {LogLevel} from '../../src/utils/logger.ts';

// Non-billable lifecycle fixture. This is never loaded by production route discovery.
const logger = new Logger('LifecycleFixture', LogLevel.INFO);
const sockets = trackWebSockets({open: (socket) => {socket.send('ready');}, message: () => undefined});
const registry = new InteractionCapabilityRegistry();
for (const kind of ['internal', 'domain']) registry.issue('fixture-conversation', {
    id: `fixture-${kind}`, type: 'confirmation', actionId: `action-${kind}`, confirmLabel: 'Confirm', details: []
});
const actions = createActionPostHandler({registry, reportError: () => undefined, confirmAction: (id) =>
{
    if (id === 'action-domain') throw new ActionDomainError('action_expired');
    throw new Error('Private provider payload at /fixture/private.sqlite');
}});
const chat = createChatHandler({runChat: async (_request, emit, signal) =>
{
    emit({type: 'message.started', messageId: 'fixture-message'});
    return new Promise((_resolve, reject) =>
    {
        signal.addEventListener('abort', () => reject(signal.reason), {once: true});
        signal.throwIfAborted();
    });
}});
const server = Bun.serve<SocketData>({hostname: '127.0.0.1', port: 0, websocket: sockets.handlers,
    fetch(req, running)
    {
        const pathname = new URL(req.url).pathname;
        if (pathname === '/api/chat') return chat({req, server: running, params: {}, query: {}, pathname});
        if (pathname === '/api/actions') return actions({req, server: running, params: {}, query: {}, pathname});
        if (pathname === '/ws')
        {
            return running.upgrade(req, {data: {pathname, query: {}, params: {}}}) ? undefined : new Response(null, {status: 400});
        }
        if (pathname === '/stall' || pathname === '/healthy')
        {
            running.timeout(req, 0);
            let timer: ReturnType<typeof setTimeout> | undefined;
            return new Response(new ReadableStream({
                start(output)
                {
                    output.enqueue('started\n');
                    if (pathname === '/healthy') timer = setTimeout(() => {output.enqueue('finished\n'); output.close();}, 100);
                },
                cancel() {clearTimeout(timer);}
            }));
        }
        return new Response('healthy');
    }
});
installShutdownHandlers(server, logger, {closeSockets: sockets.close});
console.log(`FIXTURE_READY ${server.port}`);
