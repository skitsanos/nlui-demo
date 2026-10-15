import {expect, test} from 'bun:test';
import {copyFileSync, cpSync, mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {within} from '../../tests/helpers/childServer.ts';

test('compiled provider-free evaluation CLI preserves routes, workers and all 35 classifications', async () =>
{
    const root = mkdtempSync(join(tmpdir(), 'nlui-compiled-evaluation-'));
    const binary = join(root, process.platform === 'win32' ? 'evaluate.exe' : 'evaluate');
    const project = resolve(import.meta.dir, '../..');
    let child: Bun.Subprocess<'ignore', 'pipe', 'pipe'> | undefined;
    const run = async (command: string[], cwd = project) =>
    {
        child = Bun.spawn(command, {cwd, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe'});
        const [exitCode, stdout] = await within(Promise.all([
            child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()
        ]), 25_000);
        expect(exitCode).toBe(0);
        return stdout;
    };
    try
    {
        await run([process.execPath, 'build', '--compile', 'scripts/eval-fixtures.ts', 'src/data/queryWorker.ts', '--outfile', binary]);
        // No source tree or node_modules: prove the worker is actually embedded,
        // not silently loaded from the developer checkout as a disk fallback.
        mkdirSync(join(root, 'data'));
        cpSync(join(project, 'data/knowledge'), join(root, 'data/knowledge'), {recursive: true});
        copyFileSync(join(project, 'data/scenarios.jsonl'), join(root, 'data/scenarios.jsonl'));
        const output = JSON.parse(await run([binary, '--json'], root));
        expect(output.kind).toBe('provider-free-reference');
        const results = output.reports.flatMap((report: {results: unknown[]}) => report.results);
        expect(results).toHaveLength(35);
        expect(results.filter((result: {status: string}) => result.status === 'passed')).toHaveLength(35);
        expect(results.filter((result: {status: string}) => result.status === 'incomplete')).toHaveLength(0);
        expect(output.reports.every((report: {versions: {evaluator: string}}) => report.versions.evaluator === 'deterministic-v3-presentation')).toBeTrue();
        const secrets = [process.env.OPENAI_API_KEY, process.env.CHAT_MODEL].filter((value): value is string => !!value);
        expect(secrets.every((value) => !JSON.stringify(output).includes(value))).toBeTrue();
    }
    finally
    {
        if (child?.exitCode === null) {child.kill(); await child.exited;}
        rmSync(root, {recursive: true, force: true});
    }
}, 40_000);
