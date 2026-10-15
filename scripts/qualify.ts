import {resolve} from 'node:path';
import {createQualificationRunner, type QualificationRunner} from './qualification/command.ts';
import {qualifyCompiled} from './qualification/compiled.ts';
import {qualifyContainer} from './qualification/container.ts';
import {verifyReferenceProfile} from './qualification/reference.ts';

export const qualify = async (mode: string, {
    project = resolve(import.meta.dir, '..'), run = createQualificationRunner(), hurl = Bun.which('hurl')
}: {project?: string; run?: QualificationRunner; hurl?: string | null} = {}): Promise<void> =>
{
    if (!['source', 'compiled', 'container', 'all'].includes(mode)) throw new Error('Expected source, compiled, container or all');
    if (mode !== 'container' && !hurl) throw new Error('Hurl is required; install @orangeopensource/hurl or see https://hurl.dev/docs/installation.html');
    if (mode === 'source' || mode === 'all')
    {
        console.log(`Source qualification on Bun ${Bun.version} (${process.platform}/${process.arch})`);
        for (const command of [['--no-env-file', 'run', 'check'], ['--no-env-file', 'run', 'eval:offline'],
            ['--no-env-file', 'scripts/smoke-http.ts']])
        {
            await run({command: [process.execPath, ...command], cwd: project, timeoutMs: 300_000});
        }
        const reference = await run({command: [process.execPath, '--no-env-file', 'scripts/eval-fixtures.ts', '--json'],
            cwd: project, capture: true, timeoutMs: 60_000});
        verifyReferenceProfile(reference.stdout);
        console.log('Source reference: 35 passed, zero incomplete; no provider.');
    }
    if (mode === 'compiled' || mode === 'all') await qualifyCompiled(project, run);
    if (mode === 'container' || mode === 'all') await qualifyContainer(project, run);
};

if (import.meta.main)
{
    const controller = new AbortController();
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => controller.abort());
    try {await qualify(Bun.argv[2] ?? 'source', {run: createQualificationRunner(controller.signal)});}
    catch {console.error('Qualification failed; inspect the preceding gate output. Private captured diagnostics were withheld.'); process.exitCode = 1;}
}
