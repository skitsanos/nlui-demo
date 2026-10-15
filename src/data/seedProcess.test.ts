import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import manifest from '../../data/fixture-manifest.json';
import {within} from '../../tests/helpers/childServer.ts';
import {inspectEvaluationDataset} from '../evals/datasetState.ts';

const projectRoot = resolve(import.meta.dir, '../..');
let directory: string;
let binary: string;
let child: Bun.Subprocess<'ignore', 'pipe', 'pipe'> | undefined;
const run = async (command: string[]): Promise<string> =>
{
    child = Bun.spawn(command, {cwd: projectRoot, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe'});
    try
    {
        const [exitCode, stdout] = await within(Promise.all([
            child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()
        ]), 20_000);
        expect(exitCode).toBe(0);
        return stdout;
    }
    finally
    {
        if (child.exitCode === null) {child.kill(); await child.exited;}
        child = undefined;
    }
};
beforeAll(async () =>
{
    directory = mkdtempSync(join(tmpdir(), 'nlui-seed-process-'));
    binary = join(directory, process.platform === 'win32' ? 'seed.exe' : 'seed');
    await run([process.execPath, 'build', '--compile', 'scripts/seed.ts', '--outfile', binary]);
}, 30_000);
afterAll(async () =>
{
    if (child?.exitCode === null) {child.kill(); await child.exited;}
    if (directory) rmSync(directory, {recursive: true, force: true});
});

describe('snapshot fixture through the real seed CLI', () =>
{
    for (const mode of ['source', 'compiled'] as const)
    {
        test(`${mode} creates the v2 baseline and reuses it without a reset`, async () =>
        {
            const databasePath = join(directory, `${mode}.sqlite`);
            const command = mode === 'source' ? [process.execPath, 'scripts/seed.ts'] : [binary];
            const first = JSON.parse(await run([...command, '--database', databasePath]));
            expect(first).toMatchObject({databasePath, datasetVersion: 2, seeded: true,
                summary: {customers: 200, orders: 1500, products: 100}});
            expect(inspectEvaluationDataset(databasePath)).toEqual({fingerprint: manifest.baselineFingerprint,
                baselineFingerprint: manifest.baselineFingerprint, isBaseline: true});
            const next = JSON.parse(await run([...command, '--database', databasePath]));
            expect(next).toMatchObject({datasetVersion: 2, seeded: false});
            expect(inspectEvaluationDataset(databasePath).fingerprint).toBe(manifest.baselineFingerprint);
        }, 30_000);
    }
});
