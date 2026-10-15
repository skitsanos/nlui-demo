import {describe, expect, test} from 'bun:test';
import type {RouteSocket, SocketData} from '../core/types.ts';
import Logger, {LogLevel} from '../utils/logger.ts';
import {createShutdownHandler} from './lifecycle.ts';
import {trackWebSockets} from './socketLifecycle.ts';

const logger = new Logger('shutdown-test', LogLevel.FATAL);
const serverFor = (stop: (force?: boolean) => Promise<void>): Pick<Bun.Server<SocketData>, 'stop'> => ({stop});

describe('bounded shutdown', () =>
{
    test('healthy work drains once and repeated signals share the same shutdown', async () =>
    {
        const calls: Array<boolean | undefined> = [];
        const exits: number[] = [];
        let closeSockets = 0;
        const shutdown = createShutdownHandler(serverFor(async (force) => {calls.push(force);}), logger,
            {gracePeriodMs: 200, closeSockets: () => {closeSockets += 1;}, exit: (code) => {exits.push(code);}});
        const first = shutdown('SIGTERM');
        expect(shutdown('SIGINT')).toBe(first);
        await first;
        expect(calls).toEqual([undefined]);
        expect(exits).toEqual([0]);
        expect(closeSockets).toBe(1);
    });

    test('an unfinished drain is force-stopped within its budget, even if force-stop never settles', async () =>
    {
        const calls: Array<boolean | undefined> = [];
        const exits: number[] = [];
        const shutdown = createShutdownHandler(serverFor((force) =>
        {
            calls.push(force);
            return new Promise(() => undefined);
        }), logger, {gracePeriodMs: 25, exit: (code) => {exits.push(code);}});
        const start = performance.now();
        await shutdown('SIGTERM');
        expect(performance.now() - start).toBeLessThan(500);
        expect(calls).toEqual([undefined, true]);
        expect(exits).toEqual([0]);
    });

    test('late graceful completion after forced shutdown cannot exit twice', async () =>
    {
        let drain: () => void;
        const pending = new Promise<void>((resolve) => {drain = resolve;});
        const exits: number[] = [];
        const shutdown = createShutdownHandler(serverFor(async (force) => {if (!force) await pending;}), logger,
            {gracePeriodMs: 20, exit: (code) => {exits.push(code);}});
        await shutdown('SIGINT');
        drain!();
        await Promise.resolve();
        await shutdown('SIGTERM');
        expect(exits).toEqual([0]);
    });

    test.each(['throw', 'reject', 'socket'])('failure during %s forces closure with exit 1', async (failure) =>
    {
        const calls: Array<boolean | undefined> = [];
        const exits: number[] = [];
        const shutdown = createShutdownHandler(serverFor((force) =>
        {
            calls.push(force);
            if (!force && failure === 'throw') throw new Error('private shutdown detail');
            if (!force && failure === 'reject') return Promise.reject(new Error('private shutdown detail'));
            return Promise.resolve();
        }), logger, {gracePeriodMs: 100, exit: (code) => {exits.push(code);},
            closeSockets: () => {if (failure === 'socket') throw new Error('socket failure');}});
        await shutdown('SIGTERM');
        expect(calls).toEqual([undefined, true]);
        expect(exits).toEqual([1]);
    });

    test('only active tracked sockets receive the restart close code', () =>
    {
        const closed: Array<[number, string]> = [];
        const tracker = trackWebSockets({message: () => undefined});
        const socket = {close: (code: number, reason: string) => closed.push([code, reason])} as unknown as RouteSocket;
        tracker.handlers.open(socket);
        tracker.close();
        expect(closed).toEqual([[1012, 'Server restarting']]);
        tracker.handlers.close(socket, 1012, 'Server restarting');
        tracker.close();
        expect(closed).toHaveLength(1);
    });
});
