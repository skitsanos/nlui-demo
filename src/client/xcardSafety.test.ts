import {expect, test} from 'bun:test';
import {within} from '../../tests/helpers/childServer.ts';

test('actual X Card resolves qualified root-model bindings into the production owned renderer', async () =>
{
    const child = Bun.spawn([process.execPath, '--no-env-file', 'tests/fixtures/xcard-probe.tsx'], {
        cwd: new URL('../..', import.meta.url).pathname, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
        env: {...process.env, OPENAI_API_KEY: '', CHAT_MODEL: ''}
    });
    try
    {
        const [exit, stdout, stderr] = await within(Promise.all([child.exited,
            new Response(child.stdout).text(), new Response(child.stderr).text()]), 15_000);
        expect(exit, stderr).toBe(0); expect(stdout).toContain('XCARD_PROBE_OK');
    }
    finally {if (child.exitCode === null) {child.kill(); await child.exited;}}
}, 20_000);
