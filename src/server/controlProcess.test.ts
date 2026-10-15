import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnFixture, within} from '../../tests/helpers/childServer.ts';
import type {FormBlock} from '../nlui/types.ts';

const project = resolve(import.meta.dir, '../..');
const fixture = join(project, 'tests/fixtures/controls-server.ts');
let root: string;
let binary: string;
beforeAll(async () =>
{
    root = await mkdtemp(join(tmpdir(), 'nlui-control-process-test-'));
    binary = join(root, process.platform === 'win32' ? 'controls.exe' : 'controls');
    const build = Bun.spawn([process.execPath, 'build', '--compile', fixture, '--outfile', binary], {
        cwd: project, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe'
    });
    const drained = Promise.all([new Response(build.stdout).text(), new Response(build.stderr).text()]);
    expect(await within(build.exited, 30_000)).toBe(0);
    await drained;
}, 40_000);
afterAll(async () => {if (root) await rm(root, {recursive: true, force: true});});

describe.skipIf(process.platform === 'win32')('source/compiled form capability boundary', () =>
{
    for (const compiled of [false, true]) test(`${compiled ? 'compiled' : 'source'} canonicalizes null and rejects tampered fields before execution`, async () =>
    {
        const running = await spawnFixture(compiled ? [binary] : [process.execPath, fixture], project, {});
        try
        {
            const {forms} = await (await fetch(`${running.url}/api/fixture`)).json() as {forms: FormBlock[]};
            const form = forms[0]!;
            const conversationId = `controls-${form.interactionId}`;
            const post = (values: Record<string, unknown>) => fetch(`${running.url}/api/chat`, {method: 'POST',
                headers: {'Content-Type': 'application/json'}, body: JSON.stringify({conversationId,
                    input: {type: 'ui_result', interactionId: form.interactionId, values}})});
            const invalid = await post({use_case: 'Design', maximum_price_eur: null, extra: null});
            expect(invalid.status).toBe(400);
            await invalid.arrayBuffer();
            const response = await post({use_case: 'Design', maximum_price_eur: null});
            expect(response.status).toBe(200);
            const state = await (await fetch(`${running.url}/api/fixture/state`)).json() as {received: unknown[]; pending: number};
            expect(state.received).toEqual([{type: 'ui_result', interactionId: form.interactionId, values: {use_case: 'Design'}}]);
            expect(state.pending).toBe(1);
            await (await fetch(`${running.url}/api/fixture/release`, {method: 'POST'})).arrayBuffer();
            expect(await within(response.text(), 2_000)).toContain('message.completed');
            running.child.kill('SIGTERM');
            expect(await within(running.child.exited, 2_000)).toBe(0);
        }
        finally
        {
            if (running.child.exitCode === null)
            {
                running.child.kill('SIGTERM');
                await within(running.child.exited, 2_000).catch(() => undefined);
            }
            await running.stop();
        }
    }, 15_000);
});
