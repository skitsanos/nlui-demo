import {describe, expect, test} from 'bun:test';
import type {QualificationCommand, QualificationRunner} from '../../scripts/qualification/command.ts';
import {qualifyContainer} from '../../scripts/qualification/container.ts';
import {referenceOutput} from './profile.ts';

const harness = (failure?: string) =>
{
    const calls: QualificationCommand[] = [];
    let healthChecks = 0;
    const run: QualificationRunner = async (options) =>
    {
        calls.push(options);
        const command = options.command.join(' ');
        if (failure && command.includes(failure) && !options.cleanup) throw new Error('Injected container failure');
        return {code: 0, stdout: command.includes('.State.Health.Status') ? ++healthChecks === 1 ? 'starting' : 'healthy'
            : command.includes('.State.ExitCode') ? '0' : command.includes('eval-fixtures.ts') ? referenceOutput() : ''};
    };
    return {calls, run};
};

describe('owned production-container qualification', () =>
{
    test('uses a pulled production image, no network/mounts/secrets, real probes and scoped cleanup', async () =>
    {
        const {calls, run} = harness();
        await qualifyContainer('/fixture/project', run, async () => undefined);
        const build = calls.find(({command}) => command[1] === 'build')!.command;
        expect(build).toContain('--pull');
        const create = calls.find(({command}) => command[1] === 'create')!.command;
        expect(create).toContain('none');
        expect(create).toContain('PORT=3180');
        expect(create.some((part) => /mount|volume|env-file|OPENAI_API_KEY/.test(part))).toBeFalse();
        expect(calls.filter(({command}) => command.includes('{{.State.Health.Status}}'))).toHaveLength(2);
        expect(calls.some(({command}) => command.includes('/tmp/qualification-probe.ts'))).toBeTrue();
        expect(calls.some(({command}) => command.includes('scripts/eval-fixtures.ts'))).toBeTrue();
        expect(calls.some(({command}) => command.includes('stop'))).toBeTrue();
        expect(calls.slice(-2).every(({cleanup}) => cleanup)).toBeTrue();
        const container = create[create.indexOf('--name') + 1]!;
        const image = create.at(-1)!;
        expect(calls.at(-2)!.command).toEqual(['docker', 'rm', '--force', container]);
        expect(calls.at(-1)!.command).toEqual(['docker', 'image', 'rm', image]);
    });
    test.each(['docker create', 'docker start', 'docker cp', 'qualification-probe.ts', 'eval-fixtures.ts', 'docker stop'])
    ('cleans only owned resources after failure at %s', async (failure) =>
    {
        const {calls, run} = harness(failure);
        await expect(qualifyContainer('/fixture/project', run, async () => undefined)).rejects.toThrow('Injected');
        expect(calls.slice(-2).map(({command}) => command.slice(0, 3))).toEqual([
            ['docker', 'rm', '--force'], ['docker', 'image', 'rm']
        ]);
        expect(calls.every(({command}) => !command.includes('prune'))).toBeTrue();
    });
    test.each(['unhealthy', 'starting', 'exit'])('fails closed on unhealthy/never-ready/nonzero-exit containers: %s', async (kind) =>
    {
        const {calls, run: base} = harness();
        const run: QualificationRunner = async (options) =>
        {
            const result = await base(options);
            if (options.command.includes('{{.State.Health.Status}}') && kind !== 'exit') result.stdout = kind;
            if (options.command.includes('{{.State.ExitCode}}')) result.stdout = '137';
            return result;
        };
        await expect(qualifyContainer('/fixture/project', run, async () => undefined)).rejects.toThrow();
        expect(calls.at(-1)!.command.slice(0, 3)).toEqual(['docker', 'image', 'rm']);
    });
    test('attempts owned image cleanup even when container removal fails', async () =>
    {
        const {calls, run: base} = harness();
        const run: QualificationRunner = async (options) =>
        {
            await base(options);
            if (options.cleanup && options.command[1] === 'rm') throw new Error('Removal failed');
            return {code: 0, stdout: options.command.includes('eval-fixtures.ts') ? referenceOutput()
                : options.command.includes('{{.State.Health.Status}}') ? 'healthy' : '0'};
        };
        await expect(qualifyContainer('/fixture/project', run, async () => undefined)).rejects.toThrow('Removal failed');
        expect(calls.at(-1)!.command.slice(0, 3)).toEqual(['docker', 'image', 'rm']);
    });
});
