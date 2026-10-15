import {resolve} from 'node:path';
import type {QualificationRunner} from './command.ts';
import {verifyReferenceProfile} from './reference.ts';

export const qualifyContainer = async (project: string, run: QualificationRunner, pause = () => Bun.sleep(250)): Promise<void> =>
{
    const id = `nlui-qualification-${crypto.randomUUID()}`;
    const image = `${id}:local`;
    let created = false;
    let createAttempted = false;
    let built = false;
    try
    {
        await run({command: ['docker', 'info'], capture: true, timeoutMs: 15_000});
        await run({command: ['docker', 'build', '--pull', '--label', `io.nlui.qualification=${id}`, '-t', image, '.'],
            cwd: project, timeoutMs: 600_000});
        built = true;
        createAttempted = true;
        await run({command: ['docker', 'create', '--name', id, '--label', `io.nlui.qualification=${id}`,
            '--network', 'none', '--env', 'PORT=3180', '--env', 'LOG_LEVEL=ERROR', '--env', 'NLUI_EVAL_LIVE=0',
            '--health-interval=1s', '--health-start-period=1s', '--health-timeout=2s', '--health-retries=15', image], capture: true});
        created = true;
        await run({command: ['docker', 'start', id], capture: true});
        await run({command: ['docker', 'cp', resolve(project, 'tests/fixtures/container-probe.ts'), `${id}:/tmp/qualification-probe.ts`]});
        await run({command: ['docker', 'exec', id, 'bun', '--no-env-file', '/tmp/qualification-probe.ts'], timeoutMs: 45_000});
        for (let attempt = 0; ; attempt++)
        {
            const health = await run({command: ['docker', 'inspect', '--format', '{{.State.Health.Status}}', id], capture: true});
            if (health.stdout.trim() === 'healthy') break;
            if (health.stdout.trim() !== 'starting' || attempt >= 59) throw new Error('Image healthcheck did not pass with the overridden PORT');
            await pause();
        }
        const reference = await run({command: ['docker', 'exec', id, 'bun', '--no-env-file',
            'scripts/eval-fixtures.ts', '--json'], capture: true, timeoutMs: 90_000});
        verifyReferenceProfile(reference.stdout);
        await run({command: ['docker', 'stop', '--time', '10', id], capture: true, timeoutMs: 15_000});
        const exit = await run({command: ['docker', 'inspect', '--format', '{{.State.ExitCode}}', id], capture: true});
        if (exit.stdout.trim() !== '0') throw new Error('Container did not shut down successfully on SIGTERM');
        console.log('Container: production HTTP/data/permissions/health/shutdown passed; reference 35 passed, zero incomplete.');
    }
    finally
    {
        // Exact, unique owned resources only. Never prune images or volumes, and
        // never mount a developer database, uploads directory or Docker socket.
        try
        {
            if (createAttempted) await run({command: ['docker', 'rm', '--force', id], capture: true, cleanup: true, allowFailure: !created});
        }
        finally
        {
            if (built) await run({command: ['docker', 'image', 'rm', image], capture: true, cleanup: true});
        }
    }
};
