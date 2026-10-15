import {describe, expect, test} from 'bun:test';
import {resolveServerLimits, serverLimitsSchema} from './serverLimits.ts';

describe('finite server budgets', () =>
{
    test('uses finite defaults and explicit environment overrides', () =>
    {
        expect(resolveServerLimits({}, {})).toEqual({chatRequestTimeoutMs: 120_000, shutdownGracePeriodMs: 5_000});
        expect(resolveServerLimits({chatRequestTimeoutMs: 1_000, shutdownGracePeriodMs: 300}, {
            CHAT_REQUEST_TIMEOUT_MS: '2000', SHUTDOWN_GRACE_PERIOD_MS: '400'
        })).toEqual({chatRequestTimeoutMs: 2_000, shutdownGracePeriodMs: 400});
    });

    test.each(['0', '-1', '1.5', 'Infinity', 'NaN', '', ' ', '1e3', '0x20', '600001'])('rejects invalid timeout override %s', (value) =>
    {
        expect(() => resolveServerLimits({}, {CHAT_REQUEST_TIMEOUT_MS: value})).toThrow();
    });

    test.each(['0', '-1', '1.5', 'Infinity', '', '60001'])('rejects invalid grace override %s', (value) =>
    {
        expect(() => resolveServerLimits({}, {SHUTDOWN_GRACE_PERIOD_MS: value})).toThrow();
    });

    test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 0.5, 600_001])('rejects invalid YAML budget %s', (value) =>
    {
        expect(serverLimitsSchema.safeParse({chatRequestTimeoutMs: value}).success).toBeFalse();
    });
});
