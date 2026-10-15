import {expect, test} from 'bun:test';
import {within} from '../../tests/helpers/childServer.ts';

test('patched KaTeX and the actual Markdown renderer preserve math, formatting and sanitization', async () =>
{
    const child = Bun.spawn([process.execPath, '--no-env-file', 'tests/fixtures/markdown-probe.tsx'], {
        cwd: new URL('../..', import.meta.url).pathname, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
        env: {...process.env, OPENAI_API_KEY: '', CHAT_MODEL: ''}
    });
    try
    {
        const [exit, stdout, stderr] = await within(Promise.all([child.exited,
            new Response(child.stdout).text(), new Response(child.stderr).text()]), 15_000);
        expect(exit, stderr).toBe(0);
        expect(stdout).toContain('MARKDOWN_PROBE_OK');
        const css = await Bun.file(new URL('./styles.css', import.meta.url)).text();
        expect(css).toContain('.katex-html > .katex-tag { position: static; }');
    }
    finally
    {
        if (child.exitCode === null) {child.kill(); await child.exited;}
    }
}, 20_000);
