import config from '@/core/configuration.ts';
import type {SocketData} from '@/core/types.ts';
import type Logger from '@/utils/logger.ts';

export const resolvePort = (value: string | undefined, logger: Logger): number =>
{
    if (value === undefined || value.trim() === '')
    {
        return config.server.port;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535)
    {
        logger.fatal(`Invalid PORT: ${value}`);
        process.exit(1);
    }

    return parsed;
};

interface ShutdownOptions
{
    gracePeriodMs?: number;
    closeSockets?: () => void;
    exit?: (code: number) => void;
}

/** Stop admissions, drain healthy work, then force-close at an absolute deadline. */
export const createShutdownHandler = (
    server: Pick<Bun.Server<SocketData>, 'stop'>,
    logger: Logger,
    {gracePeriodMs = config.server.shutdownGracePeriodMs, closeSockets, exit = (code) => process.exit(code)}: ShutdownOptions = {}
): ((signal: string) => Promise<void>) =>
{
    if (!Number.isSafeInteger(gracePeriodMs) || gracePeriodMs <= 0) throw new RangeError('A finite positive shutdown grace period is required');
    let stopping: Promise<void> | undefined;
    return (signal) =>
    {
        stopping ??= new Promise<void>((resolve) =>
        {
            let finished = false;
            const finish = (code: number): void =>
            {
                if (finished) return;
                finished = true;
                clearTimeout(deadline);
                try {exit(code);} finally {resolve();}
            };
            const force = (code: number): void =>
            {
                if (finished) return;
                try {void Promise.resolve(server.stop(true)).catch(() => undefined);}
                catch { /* Process termination remains bounded if force-stop fails. */ }
                finish(code);
            };
            const deadline = setTimeout(() =>
            {
                logger.warn('Shutdown grace period elapsed; closing remaining connections');
                force(0);
            }, gracePeriodMs);
            logger.info(`Received ${signal}, shutting down...`);
            try
            {
                const stopped = server.stop();
                closeSockets?.();
                void Promise.resolve(stopped).then(() =>
                {
                    if (!finished) logger.info('Server stopped');
                    finish(0);
                }, () =>
                {
                    logger.error('Error during shutdown');
                    force(1);
                });
            }
            catch
            {
                logger.error('Error during shutdown');
                force(1);
            }
        });
        return stopping;
    };
};

/** Repeated signals share one drain/deadline and cannot reset the grace period. */
export const installShutdownHandlers = (
    server: Bun.Server<SocketData>,
    logger: Logger,
    options: ShutdownOptions = {}
): (() => void) =>
{
    const shutdown = createShutdownHandler(server, logger, options);
    const interrupt = () => {void shutdown('SIGINT');};
    const terminate = () => {void shutdown('SIGTERM');};
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', terminate);
    return () =>
    {
        process.off('SIGINT', interrupt);
        process.off('SIGTERM', terminate);
    };
};
