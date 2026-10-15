import {describe, expect, test} from 'bun:test';
import {createQualificationRunner, qualificationEnvironment} from '../../scripts/qualification/command.ts';
import {verifyReferenceProfile} from '../../scripts/qualification/reference.ts';
import {qualify} from '../../scripts/qualify.ts';
import {referenceOutput} from './profile.ts';

describe('non-billable, fail-closed qualification commands', () =>
{
    test('withholds inherited provider values without mutating the caller environment', () =>
    {
        const original = {PATH: '/fixture/bin', OPENAI_API_KEY: 'fixture-secret', CHAT_MODEL: 'fixture-model',
            OPENAI_BASE_URL: 'https://private.invalid', NLUI_EVAL_LIVE: '1'};
        expect(qualificationEnvironment(original)).toEqual({PATH: '/fixture/bin', OPENAI_API_KEY: '', CHAT_MODEL: '', NLUI_EVAL_LIVE: '0'});
        expect(original.OPENAI_API_KEY).toBe('fixture-secret');
        expect(original.NLUI_EVAL_LIVE).toBe('1');
    });
    test('preflights the mandatory Hurl CLI before any source or compiled gate', async () =>
    {
        let calls = 0;
        for (const mode of ['source', 'compiled', 'all']) await expect(qualify(mode, {
            hurl: null, run: async () => {calls++; return {code: 0, stdout: ''};}
        })).rejects.toThrow('Hurl is required');
        expect(calls).toBe(0);
    });
    test('runs static/regression, offline, HTTP and exact reference checks in source mode', async () =>
    {
        const commands: string[][] = [];
        await qualify('source', {hurl: '/fixture/hurl', run: async ({command}) =>
        {
            commands.push(command);
            return {code: 0, stdout: referenceOutput()};
        }});
        expect(commands.map((command) => command.slice(1))).toEqual([
            ['--no-env-file', 'run', 'check'], ['--no-env-file', 'run', 'eval:offline'],
            ['--no-env-file', 'scripts/smoke-http.ts'], ['--no-env-file', 'scripts/eval-fixtures.ts', '--json']
        ]);
    });
    test('propagates a failed gate without running later commands', async () =>
    {
        let calls = 0;
        await expect(qualify('source', {hurl: '/fixture/hurl', run: async () => {calls++; throw new Error('Gate failed');}}))
            .rejects.toThrow('Gate failed');
        expect(calls).toBe(1);
        await expect(qualify('unknown')).rejects.toThrow('Expected source');
    });
    test.each(['error', 'duplicate', 'incomplete', 'missing', 'wrong-id', 'stale-version', 'missing-version'])('rejects reference drift: %s', (kind) =>
    {
        const output = JSON.parse(referenceOutput());
        const results = output.reports[0].results;
        if (kind === 'error') results[0].status = 'error';
        if (kind === 'duplicate') results[1].scenarioId = results[0].scenarioId;
        if (kind === 'incomplete') results[0].status = 'incomplete';
        if (kind === 'wrong-id') results[0].scenarioId = 'unrelated-case';
        if (kind === 'stale-version') output.reports[0].versions.evaluator = 'deterministic-v2';
        if (kind === 'missing-version') delete output.reports[0].versions;
        if (kind === 'missing') results.pop();
        expect(() => verifyReferenceProfile(JSON.stringify(output))).toThrow('Unexpected provider-free');
    });
    test('executes a real child without provider configuration or dotenv, and rejects nonzero exit', async () =>
    {
        const run = createQualificationRunner();
        const result = await run({command: [process.execPath, '--no-env-file', '--eval',
            'console.log(JSON.stringify({key:process.env.OPENAI_API_KEY,model:process.env.CHAT_MODEL,live:process.env.NLUI_EVAL_LIVE}))'], capture: true});
        expect(JSON.parse(result.stdout)).toEqual({key: '', model: '', live: '0'});
        await expect(run({command: [process.execPath, '--no-env-file', '--eval', 'console.error("private fixture");process.exit(7)'], capture: true}))
            .rejects.toThrow('exit 7');
    });
    test('bounds a stalled subprocess and handles cancellation before startup', async () =>
    {
        const command = [process.execPath, '--no-env-file', '--eval', 'await Bun.sleep(10000)'];
        await expect(createQualificationRunner()({command, timeoutMs: 30, capture: true})).rejects.toThrow('timed out');
        await expect(createQualificationRunner(AbortSignal.abort())({command, capture: true})).rejects.toThrow('cancelled');
    });
});
