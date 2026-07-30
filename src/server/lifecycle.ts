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

/** Installs an idempotent graceful shutdown for process termination signals. */
export const installShutdownHandlers = (
    server: Bun.Server<SocketData>,
    logger: Logger
): void =>
{
    let shuttingDown = false;

    const shutdown = async (signal: string): Promise<void> =>
    {
        if (shuttingDown)
        {
            return;
        }
        shuttingDown = true;

        logger.info(`Received ${signal}, shutting down...`);

        try
        {
            await server.stop();
            logger.info('Server stopped');
            process.exit(0);
        }
        catch (error)
        {
            logger.error('Error during shutdown', {error});
            process.exit(1);
        }
    };

    for (const signal of ['SIGINT', 'SIGTERM'] as const)
    {
        process.on(signal, () => void shutdown(signal));
    }
};
