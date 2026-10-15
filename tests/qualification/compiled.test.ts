import {describe, expect, test} from 'bun:test';
import {mkdtemp, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import type {QualificationCommand, QualificationRunner} from '../../scripts/qualification/command.ts';
import {qualifyCompiled} from '../../scripts/qualification/compiled.ts';
import {referenceOutput} from './profile.ts';

describe('owned compiled qualification packaging', () =>
{
    test.each(['success', 'first-build', 'http', 'reference-build', 'reference-profile'])
    ('cleans only owned binaries/fixtures at every boundary: %s', async (boundary) =>
    {
        const root = await mkdtemp(join(tmpdir(), 'nlui-compiled-gate-test-'));
        const calls: QualificationCommand[] = [];
        try
        {
            await writeFile(join(root, 'retained-artifact'), 'retained');
            const run: QualificationRunner = async (options) =>
            {
                calls.push(options);
                const command = options.command;
                const build = command.includes('build');
                const reference = command.includes('scripts/eval-fixtures.ts');
                if ((boundary === 'first-build' && calls.length === 1) || (boundary === 'http' && command.includes('scripts/smoke-http.ts'))
                    || (boundary === 'reference-build' && build && reference)) throw new Error('Injected compiled failure');
                if (!build && command.includes('--json'))
                {
                    expect((await readdir(options.cwd!)).sort()).toEqual(['data']);
                    expect((await readdir(join(options.cwd!, 'data'))).sort()).toEqual(['knowledge', 'scenarios.jsonl']);
                }
                return {code: 0, stdout: boundary === 'reference-profile' ? '{}' : referenceOutput()};
            };
            const result = qualifyCompiled(resolve(import.meta.dir, '../..'), run, root);
            if (boundary === 'success') await result;
            else await expect(result).rejects.toThrow();
            expect(await readdir(root)).toEqual(['retained-artifact']);
            expect(await Bun.file(join(root, 'retained-artifact')).text()).toBe('retained');
            for (const {command} of calls.filter(({command}) => command.includes('build')))
            {
                expect(command).toContain('--production');
                expect(command).toContain('src/data/queryWorker.ts');
                expect(command).toContain('--no-env-file');
            }
        }
        finally {await rm(root, {recursive: true, force: true});}
    });
});
