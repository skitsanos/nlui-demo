import {afterAll, beforeAll, expect, test} from 'bun:test';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnFixture, within} from '../../../tests/helpers/childServer.ts';

const project = resolve(import.meta.dir, '../../..');
const fixture = join(project, 'tests/fixtures/presentation-selection-server.ts');
let root: string; let binary: string;
beforeAll(async () =>
{
    root = await mkdtemp(join(tmpdir(), 'nlui-presentation-process-')); binary = join(root, 'presentation');
    const build = Bun.spawn([process.execPath, '--no-env-file', 'build', '--production', '--compile', fixture, '--outfile', binary], {
        cwd: project, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe'});
    const [exit, , error] = await within(Promise.all([build.exited, new Response(build.stdout).text(), new Response(build.stderr).text()]), 30_000);
    expect(exit, error).toBe(0);
}, 40_000);
afterAll(async () => {if (root) await rm(root, {recursive: true, force: true});});
for (const compiled of [false, true]) test(`matched ${compiled ? 'compiled' : 'source'} fixture publishes qualified cases without a provider`, async () =>
{
    const server = await spawnFixture(compiled ? [binary] : [process.execPath, '--no-env-file', fixture], project,
        {NODE_ENV: 'production', OPENAI_API_KEY: '', CHAT_MODEL: ''});
    try
    {
        const response = await fetch(`${server.url}/api/fixture/presentations`);
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.report.summary).toEqual({matchedCases: 16, eligibleInfographicCases: 3, baselineReferenceFailures: 0,
            candidateReferenceFailures: 0, injectedFailuresDetected: 24, wrongInfographicsRejected: 39});
        expect(body.report.dataset.unchanged).toBeTrue(); expect(body.pairs).toHaveLength(16);
        expect(body.report.accounting.providerRequests).toBe(0);
        const html = await (await fetch(server.url)).text();
        expect(html).toContain('NLUI matched presentation evaluation');
        const script = html.match(/src="([^"]+\.js)"/)!;
        expect(script).not.toBeNull();
        expect((await fetch(new URL(script[1]!, server.url))).status).toBe(200);
    }
    finally {await server.stop();}
}, 15_000);
