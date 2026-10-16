import {afterAll, beforeAll, expect, test} from 'bun:test';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnFixture, within} from '../../tests/helpers/childServer.ts';
import {infographicBlockSchema} from '../nlui/infographic/schema.ts';

const project = resolve(import.meta.dir, '../..');
const fixture = join(project, 'tests/fixtures/infographic-server.ts');
let root: string; let binary: string;
beforeAll(async () =>
{
    root = await mkdtemp(join(tmpdir(), 'nlui-infographic-process-')); binary = join(root, 'infographic');
    const build = Bun.spawn([process.execPath, '--no-env-file', 'build', '--compile', fixture, '--outfile', binary], {
        cwd: project, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe'});
    const [exit, , stderr] = await within(Promise.all([build.exited, new Response(build.stdout).text(), new Response(build.stderr).text()]), 30_000);
    expect(exit, stderr).toBe(0);
}, 40_000);
afterAll(async () => {if (root) await rm(root, {recursive: true, force: true});});

for (const compiled of [false, true]) for (const enabled of [false, true])
    test(`infographic ${compiled ? 'compiled' : 'source'} HTTP gate ${enabled ? 'enabled' : 'disabled'} preserves source-backed content`, async () =>
    {
        const running = await spawnFixture(compiled ? [binary] : [process.execPath, '--no-env-file', fixture], project, {NLUI_INFOGRAPHICS: enabled ? '1' : '0'});
        try
        {
            const response = await fetch(`${running.url}/api/fixture/qualification`);
            expect(response.status).toBe(200);
            const body = await response.json() as {enabled: boolean; tools: string[]; blocks: unknown[]; rejected: number};
            expect(body.enabled).toBe(enabled); expect(body.tools.includes('get_infographic')).toBe(enabled);
            expect(body.rejected).toBe(enabled ? 0 : 3);
            expect(body.blocks).toHaveLength(enabled ? 3 : 0);
            if (enabled)
            {
                const blocks = body.blocks.map((block) => infographicBlockSchema.parse(block));
                expect(blocks.map(({view}) => view)).toEqual(['comparison', 'timeline', 'process']);
                expect(blocks[0]?.items.map(({value}) => value)).toEqual([86554.26, 117577.77]);
                expect(blocks[2]?.items[3]?.detail).toEndWith('unless the item was damaged or incorrect.');
            }
            const html = await (await fetch(running.url)).text();
            expect(html).toContain('NLUI infographic qualification');
        }
        finally {await running.stop();}
    }, 15_000);
