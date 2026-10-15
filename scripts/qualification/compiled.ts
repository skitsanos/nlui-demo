import {copyFile, cp, mkdir, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {QualificationRunner} from './command.ts';
import {verifyReferenceProfile} from './reference.ts';

export const qualifyCompiled = async (project: string, run: QualificationRunner, temporaryParent = tmpdir()): Promise<void> =>
{
    const root = await mkdtemp(join(temporaryParent, 'nlui-compiled-qualification-'));
    try
    {
        const binary = join(root, process.platform === 'win32' ? 'demo.exe' : 'demo');
        await run({command: [process.execPath, '--no-env-file', 'build', '--compile', '--production',
            'src/index.ts', 'src/data/queryWorker.ts', '--outfile', binary], cwd: project});
        await run({command: [process.execPath, '--no-env-file', 'scripts/smoke-http.ts', '--compiled', binary],
            cwd: project, timeoutMs: 90_000});
        const reference = join(root, process.platform === 'win32' ? 'evaluate.exe' : 'evaluate');
        await run({command: [process.execPath, '--no-env-file', 'build', '--compile', '--production',
            'scripts/eval-fixtures.ts', 'src/data/queryWorker.ts', '--outfile', reference], cwd: project});
        await mkdir(join(root, 'data'));
        await cp(join(project, 'data/knowledge'), join(root, 'data/knowledge'), {recursive: true});
        await copyFile(join(project, 'data/scenarios.jsonl'), join(root, 'data/scenarios.jsonl'));
        // No source/dependencies beside this binary: a missing embedded worker
        // cannot be hidden by a fallback into the developer checkout.
        const result = await run({command: [reference, '--json'], cwd: root, capture: true, timeoutMs: 60_000});
        verifyReferenceProfile(result.stdout);
        console.log('Compiled reference: 28 passed, seven explicitly incomplete; no source fallback.');
    }
    finally {await rm(root, {recursive: true, force: true});}
};
