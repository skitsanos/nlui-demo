import {describe, expect, test} from 'bun:test';
import {resolve} from 'node:path';

const project = resolve(import.meta.dir, '../..');
const source = await Bun.file(resolve(project, '.github/workflows/qualification.yml')).text();
const workflow = Bun.YAML.parse(source) as any;
const manifest = await Bun.file(resolve(project, 'package.json')).json();

describe('CI delivery contract', () =>
{
    test('covers pushes, pull requests and manual runs with read-only permissions and bounded jobs', () =>
    {
        expect(Object.keys(workflow.on).sort()).toEqual(['pull_request', 'push', 'workflow_dispatch']);
        expect(workflow.permissions).toEqual({contents: 'read'});
        expect(workflow.concurrency['cancel-in-progress']).toBeTrue();
        expect(workflow.jobs['source-compiled'].strategy.matrix.os).toEqual(['ubuntu-latest', 'macos-latest']);
        expect(workflow.jobs['source-compiled'].strategy['fail-fast']).toBeFalse();
        expect(workflow.jobs.container['runs-on']).toBe('ubuntu-latest');
        expect(workflow.jobs.container.needs).toBe('source-compiled');
        for (const job of Object.values(workflow.jobs) as any[]) expect(job['timeout-minutes']).toBeLessThanOrEqual(20);
    });
    test('pins action identities, avoids retained credentials/secrets and uses current Bun with frozen dependencies', () =>
    {
        expect(workflow.env).toEqual({NLUI_EVAL_LIVE: '0', OPENAI_API_KEY: '', CHAT_MODEL: ''});
        expect(source).not.toContain('secrets.');
        for (const job of Object.values(workflow.jobs) as any[])
        {
            for (const step of job.steps)
            {
                expect(step['continue-on-error']).toBeUndefined();
                if (step.uses) expect(step.uses).toMatch(/^[a-z-]+\/[a-z-]+@[a-f0-9]{40}$/);
                if (step.uses?.startsWith('actions/checkout@')) expect(step.with['persist-credentials']).toBeFalse();
                if (step.uses?.startsWith('oven-sh/setup-bun@')) expect(step.with['bun-version']).toBe('latest');
            }
            expect(job.steps.some(({run}: {run?: string}) => run === 'bun install --frozen-lockfile')).toBeTrue();
        }
    });
    test('installs Hurl before the required source/compiled commands and runs the container gate', () =>
    {
        const commands = workflow.jobs['source-compiled'].steps.flatMap(({run}: {run?: string}) => run ? [run] : []);
        expect(commands.findIndex((command: string) => command.includes('@orangeopensource/hurl@8.0.4')))
            .toBeLessThan(commands.indexOf('bun run verify'));
        expect(commands).toContain('bun run test:compiled');
        expect(workflow.jobs.container.steps.some(({run}: {run?: string}) => run === 'bun run test:docker')).toBeTrue();
        for (const [script, mode] of [['verify', 'source'], ['test:compiled', 'compiled'], ['test:docker', 'container'], ['verify:all', 'all']])
        {
            expect(manifest.scripts[script]).toBe(`bun --no-env-file scripts/qualify.ts ${mode}`);
        }
        expect(manifest.scripts.lint).toContain('scripts/');
        expect(manifest.scripts.lint).toContain('tests/');
    });
});
