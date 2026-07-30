import config from '@/core/configuration.ts';
import {installShutdownHandlers, resolvePort} from '@/server/lifecycle.ts';
import {createRequestHandler} from '@/server/requestHandler.ts';
import {createRouteDispatcher} from '@/server/routing.ts';
import Logger, {LogLevel, setDefaultLogLevel} from '@/utils/logger.ts';
import {isDevelopment} from '@/utils/runtime.ts';
import homepage from './client/index.html';

if (!process.env.LOG_LEVEL)
{
    setDefaultLogLevel(LogLevel[config.logLevel]);
}

const logger = new Logger('Core');
const loggerHttp = new Logger('HTTP');
const dispatcher = createRouteDispatcher(logger);

logger.debug('Starting server...');
await dispatcher.preload();

const server = Bun.serve({
    port: resolvePort(process.env.PORT, logger),
    hostname: '0.0.0.0',
    routes: {
        '/': homepage
    },
    development: isDevelopment ? {hmr: true, console: true} : false,
    ...config.server.ssl && {
        cert: config.server.ssl.cert,
        key: config.server.ssl.key
    },
    maxRequestBodySize: config.server.maxRequestBodySize,
    fetch: createRequestHandler({
        dispatcher,
        logger,
        loggerHttp,
        serverName: process.env.SERVER_NAME
    }),
    websocket: dispatcher.websocket
});

logger.info(`Server started at ${server.url}`, {url: server.url});
installShutdownHandlers(server, logger);
