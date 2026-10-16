import {afterAll, beforeAll, expect, test} from 'bun:test';
import {existsSync} from 'node:fs';
import {cp, mkdir, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnFixture, within} from '../../tests/helpers/childServer.ts';
import {SKILL_CATALOG} from '../nlui/skills/registry.ts';

const project = resolve(import.meta.dir, '../..'); const fixture = join(project, 'tests/fixtures/skills-server.ts');
let root: string; let binary: string;
beforeAll(async () =>
{
    root = await mkdtemp(join(tmpdir(), 'nlui-skills-compiled-')); binary = join(root, 'skills');
    const child = Bun.spawn([process.execPath, '--no-env-file', 'build', '--production', '--compile', fixture,
        join(project, 'src/data/queryWorker.ts'), '--outfile', binary], {cwd: project, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe'});
    const [code, , error] = await within(Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]), 30_000);
    expect(code, error).toBe(0);
    await mkdir(join(root, 'data')); await mkdir(join(root, 'public'));
    await cp(join(project, 'data/knowledge'), join(root, 'data/knowledge'), {recursive: true});
    await cp(join(project, 'public/docs'), join(root, 'public/docs'), {recursive: true});
    // No source, node_modules or SKILL.md files beside the binary: packs and SQL worker must be embedded.
}, 40_000);
afterAll(async () => {if (root) await rm(root, {recursive: true, force: true});});
for (const compiled of [false, true]) for (const enabled of [false, true])
    test(`Skills ${compiled ? 'source-free compiled' : 'source'} HTTP gate ${enabled ? 'on' : 'off'} and real guarded workflow`, async () =>
    {
        // Parent-owned fallback cleanup also covers failed startup or forced child termination.
        const fixtureRoot = await mkdtemp(join(root, 'http-'));
        const running = await spawnFixture(compiled ? [binary] : [process.execPath, '--no-env-file', fixture], compiled ? root : project,
            {NODE_ENV: 'production', OPENAI_API_KEY: '', CHAT_MODEL: '', NLUI_SKILLS: enabled ? '1' : '0', SKILLS_FIXTURE_ROOT: fixtureRoot});
        try
        {
            const surface = await (await fetch(`${running.url}/api/fixture/skills`)).json();
            const config = await (await fetch(`${running.url}/api/config`)).json();
            expect(config.features.skills).toBe(enabled); expect(config.chat.configured).toBeFalse();
            expect(surface).toMatchObject({enabled, compiled}); expect(surface.tools.includes('load_skill')).toBe(enabled);
            expect(surface.catalog).toEqual(enabled ? [...SKILL_CATALOG] : []);
            expect(surface.attempted.blocks).toEqual([]);
            expect(surface.attempted.modelOutput.ok).toBe(enabled);
            const path = await (await fetch(`${running.url}/api/fixture/skills?id=..%2F..%2F.env`)).json();
            expect(path.attempted.modelOutput).toMatchObject({ok: false, error: enabled ? 'SKILL_INVALID_ARGUMENTS' : 'SKILLS_DISABLED'});
            const workflow = await (await fetch(`${running.url}/api/fixture/workflow`)).json();
            expect(workflow).toMatchObject({evidenceKind: 'injected_reference', providerRequests: 0, enabled});
            expect(workflow.result.blocks[0]).toMatchObject({type: 'stats', items: [{value: 200}]});
            expect(workflow.result.tools[0].rejected).toBe(!enabled);
            expect(JSON.stringify(workflow)).not.toContain('Establish the requested metric, population and period.');
            expect(JSON.stringify(workflow)).not.toContain('SKILL.md');
            const doc = await fetch(`${running.url}/docs/research`); expect(doc.status).toBe(200); expect(await doc.text()).toContain('Research status');
        }
        finally
        {
            try
            {
                if (running.child.exitCode === null) running.child.kill('SIGTERM');
                expect(await within(running.child.exited, 5_000)).toBe(0);
                expect(existsSync(fixtureRoot)).toBeFalse();
            }
            finally {await running.stop(); await rm(fixtureRoot, {recursive: true, force: true});}
        }
    }, 15_000);
