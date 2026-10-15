import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnFixture, within} from '../../tests/helpers/childServer.ts';
import {GENERIC_PUBLIC_ACTION_ERROR} from '../services/publicActionError.ts';
import {REQUEST_TIMEOUT_MESSAGE} from './requestDeadline.ts';

const fixturePath = resolve(import.meta.dir, '../../tests/fixtures/lifecycle-server.ts');
let root: string;
let binary: string;
beforeAll(async () =>
{
    root = await mkdtemp(join(tmpdir(), 'nlui-lifecycle-process-test-'));
    binary = join(root, process.platform === 'win32' ? 'lifecycle.exe' : 'lifecycle');
    const build = Bun.spawn([process.execPath, 'build', '--compile', fixturePath, '--outfile', binary], {
        cwd: resolve(import.meta.dir, '../..'), stdin: 'ignore', stdout: 'pipe', stderr: 'pipe'
    });
    const output = new Response(build.stdout).text();
    const errors = new Response(build.stderr).text();
    expect(await within(build.exited, 30_000)).toBe(0);
    await Promise.all([output, errors]);
}, 40_000);
afterAll(async () => {if (root) await rm(root, {recursive: true, force: true});});

describe.skipIf(process.platform === 'win32')('real source/compiled process lifecycle', () =>
{
    for (const compiled of [false, true])
    {
        const command = () => compiled ? [binary] : [process.execPath, fixturePath];
        test(`${compiled ? 'compiled' : 'source'} masks unexpected action failures over HTTP but preserves domain rejections`, async () =>
        {
            const server = await spawnFixture(command(), root, {CHAT_REQUEST_TIMEOUT_MS: '1000', SHUTDOWN_GRACE_PERIOD_MS: '100'});
            try
            {
                for (const kind of ['internal', 'internal', 'domain'])
                {
                    const response = await fetch(`${server.url}/api/actions`, {method: 'POST', headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({conversationId: 'fixture-conversation', interactionId: `fixture-${kind}`, actionId: `action-${kind}`})});
                    expect(response.status).toBe(kind === 'internal' ? 500 : 409);
                    expect(await response.json()).toEqual({message: kind === 'internal'
                        ? GENERIC_PUBLIC_ACTION_ERROR : 'The requested action has expired',
                        outcome: kind === 'internal' ? 'unknown' : 'rejected', retryable: kind === 'internal'});
                }
                server.child.kill('SIGTERM');
                expect(await within(server.child.exited, 1_000)).toBe(0);
            }
            finally {await server.stop();}
        }, 15_000);

        test(`${compiled ? 'compiled' : 'source'} rejects an invalid deadline before binding`, async () =>
        {
            await expect(spawnFixture(command(), root, {CHAT_REQUEST_TIMEOUT_MS: '0', SHUTDOWN_GRACE_PERIOD_MS: '100'}))
                .rejects.toThrow('exit 1');
        }, 15_000);

        test.each(['SIGINT', 'SIGTERM'] as const)(`${compiled ? 'compiled' : 'source'} forces a stalled connection closed on %s`, async (signal) =>
        {
            const server = await spawnFixture(command(), root, {SHUTDOWN_GRACE_PERIOD_MS: '100', CHAT_REQUEST_TIMEOUT_MS: '1000'});
            let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
            try
            {
                const response = await fetch(`${server.url}/stall`);
                reader = response.body!.getReader();
                await within(reader.read(), 1_000);
                const started = performance.now();
                server.child.kill(signal);
                expect(await within(server.child.exited, 1_500)).toBe(0);
                expect(performance.now() - started).toBeLessThan(1_000);
                expect(await server.logs()).toContain('Shutdown grace period elapsed');
            }
            finally {await reader?.cancel().catch(() => undefined); await server.stop();}
        }, 15_000);

        test(`${compiled ? 'compiled' : 'source'} drains a healthy stream and closes WebSockets with 1012`, async () =>
        {
            const server = await spawnFixture(command(), root, {SHUTDOWN_GRACE_PERIOD_MS: '1000', CHAT_REQUEST_TIMEOUT_MS: '1000'});
            const socket = new WebSocket(`${server.url.replace('http', 'ws')}/ws`);
            const socketReady = new Promise<void>((resolve, reject) =>
            {
                socket.onmessage = () => resolve();
                socket.onerror = () => reject(new Error('Fixture WebSocket failed'));
            });
            const socketClosed = new Promise<number>((resolve) => {socket.onclose = (event) => resolve(event.code);});
            try
            {
                await within(socketReady, 1_000);
                const response = await fetch(`${server.url}/healthy`);
                const reader = response.body!.getReader();
                const first = await within(reader.read(), 1_000);
                server.child.kill('SIGTERM');
                let body = new TextDecoder().decode(first.value);
                while (true)
                {
                    const next = await within(reader.read(), 1_000);
                    if (next.done) break;
                    body += new TextDecoder().decode(next.value);
                }
                expect(body).toBe('started\nfinished\n');
                expect(await within(socketClosed, 1_000)).toBe(1012);
                expect(await within(server.child.exited, 1_500)).toBe(0);
                expect(await server.logs()).not.toContain('Shutdown grace period elapsed');
            }
            finally {socket.close(); await server.stop();}
        }, 15_000);

        test(`${compiled ? 'compiled' : 'source'} closes a stalled chat at its configured deadline without a provider`, async () =>
        {
            const server = await spawnFixture(command(), root, {SHUTDOWN_GRACE_PERIOD_MS: '100', CHAT_REQUEST_TIMEOUT_MS: '50'});
            try
            {
                const response = await fetch(`${server.url}/api/chat`, {method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({conversationId: 'process-chat-test', input: {type: 'user_text', text: 'Stall safely'}})});
                const body = await within(response.text(), 1_000);
                const events = body.trim().split('\n').map((line) => JSON.parse(line));
                expect(events.at(-1)).toEqual({type: 'error', message: REQUEST_TIMEOUT_MESSAGE});
                expect(events.filter(({type}) => type === 'error')).toHaveLength(1);
                expect(events.some(({type}) => type === 'message.completed')).toBeFalse();
                server.child.kill('SIGTERM');
                expect(await within(server.child.exited, 1_000)).toBe(0);
            }
            finally {await server.stop();}
        }, 15_000);
    }
});
