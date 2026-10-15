import {z} from 'zod';

export const serverLimitsSchema = z.object({
    chatRequestTimeoutMs: z.number().int().min(1).max(600_000).default(120_000),
    shutdownGracePeriodMs: z.number().int().min(1).max(60_000).default(5_000)
});

export const resolveServerLimits = (
    values: z.input<typeof serverLimitsSchema>,
    environment: Record<string, string | undefined>
): z.output<typeof serverLimitsSchema> =>
{
    const milliseconds = (value: string): number => /^[1-9]\d*$/.test(value) ? Number(value) : Number.NaN;
    return serverLimitsSchema.parse({
        ...values,
        ...environment.CHAT_REQUEST_TIMEOUT_MS !== undefined && {
            chatRequestTimeoutMs: milliseconds(environment.CHAT_REQUEST_TIMEOUT_MS)
        },
        ...environment.SHUTDOWN_GRACE_PERIOD_MS !== undefined && {
            shutdownGracePeriodMs: milliseconds(environment.SHUTDOWN_GRACE_PERIOD_MS)
        }
    });
};
