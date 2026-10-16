import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import {existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import type {Response as ProviderResponse} from 'openai/resources/responses/responses';
import {ProviderRequestBudget} from '../../research/budget.ts';
import {runPresentationBenchmark} from './benchmark.ts';
import {attemptName} from './liveAttempt.ts';
import {SelectionJournal} from './liveJournal.ts';
import {gradeLiveChoice, selectionCatalog, selectionInput, selectionRequest, selectionSchedule, selectionSchema} from './liveProtocol.ts';
import {type SelectionProvider, selectionProvider, selectionUsage} from './liveProvider.ts';
import {runSelectionPilot} from './liveRun.ts';

let benchmark: Awaited<ReturnType<typeof runPresentationBenchmark>>;
const roots: string[] = [];
const root = () => {const path = mkdtempSync(join(tmpdir(), 'nlui-selection-test-')); roots.push(path); return path;};
const configuration = {apiKey: 'fake-pilot-secret', model: 'fake-configured-model'};
beforeAll(async () => {benchmark = await runPresentationBenchmark();});
afterAll(() => {for (const path of roots) rmSync(path, {recursive: true, force: true});});
const responseFor = (encoded: string, overrides: Partial<ProviderResponse> = {}): ProviderResponse => ({
    id: 'test-response', model: configuration.model, status: 'completed', output: [], output_text: encoded,
    usage: {input_tokens: 100, output_tokens: 10, total_tokens: 110,
        input_tokens_details: {cached_tokens: 10}, output_tokens_details: {reasoning_tokens: 2}}, ...overrides
} as ProviderResponse);
const referenceProvider = (custom?: (index: number, response: ProviderResponse) => ProviderResponse | Promise<ProviderResponse>) =>
{
    let calls = 0;
    const provider: SelectionProvider = async (request) =>
    {
        const input = JSON.parse(String(request.input));
        const pair = benchmark.pairs.find(({task}) => task.prompt === input.question)!;
        const arm = input.catalog.length === 9 ? 'candidate' : 'baseline';
        const response = responseFor(JSON.stringify({representation: pair.task[arm]}));
        const index = ++calls; return custom ? custom(index, response) : response;
    };
    return {provider, calls: () => calls};
};
const run = (path: string, provider: SelectionProvider, rest = {}) => runSelectionPilot({benchmark, root: path, configuration, provider, ...rest});

describe('bounded paired selection-only pilot', () =>
{
    test('freezes 16 pairs, alternates eight AB/eight BA, and does not expose oracle choices or rationales', () =>
    {
        const schedule = selectionSchedule(benchmark.pairs);
        expect(schedule).toHaveLength(32); expect(new Set(schedule.map(({label}) => label)).size).toBe(32);
        expect(schedule.filter((_, i) => i % 2 === 0).map(({arm}) => arm)).toEqual(Array.from({length: 16}, (_, i) => i % 2 ? 'candidate' : 'baseline'));
        for (const pair of benchmark.pairs)
        {
            const baseline = selectionRequest(pair, 'baseline'); const candidate = selectionRequest(pair, 'candidate');
            const a = JSON.parse(String(baseline.input)); const b = JSON.parse(String(candidate.input));
            expect({...a, catalog: null}).toEqual({...b, catalog: null});
            expect(JSON.stringify(selectionInput(pair))).not.toContain(pair.task.reason);
            expect(JSON.stringify(selectionInput(pair))).not.toContain(pair.task.caption);
            expect(baseline).toMatchObject({store: false, stream: false, max_output_tokens: 1200});
            expect(baseline).not.toHaveProperty('tools'); expect(baseline).not.toHaveProperty('previous_response_id');
        }
        expect(selectionCatalog('baseline')).toHaveLength(6); expect(selectionCatalog('candidate')).toHaveLength(9);
        expect(selectionSchema('candidate')).toMatchObject({additionalProperties: false, required: ['representation']});
    });

    test('checks catalog membership, task fit and independent content, not just valid JSON', () =>
    {
        const scalar = benchmark.pairs[0]!;
        expect(gradeLiveChoice(scalar, 'candidate', '{"representation":"stats"}')).toMatchObject({passed: true, contentVerified: true});
        expect(gradeLiveChoice(scalar, 'candidate', '{"representation":"infographic:comparison"}')).toMatchObject({passed: false, catalogValid: true, errors: ['ineligible_representation']});
        expect(gradeLiveChoice(scalar, 'baseline', '{"representation":"infographic:comparison"}').errors).toEqual(['outside_arm_catalog']);
        for (const value of ['{}', '{"representation":"unknown"}', '{"representation":"stats","code":"fetch()"}', 'not json'])
            expect(gradeLiveChoice(scalar, 'candidate', value).errors).toEqual(['invalid_choice']);
    });

    test('preserves all 32 responses, usage and immutable snapshots; rerunning cannot spend again or reset the budget', async () =>
    {
        const path = root(); const reference = referenceProvider();
        const report = await run(path, reference.provider);
        expect(reference.calls()).toBe(32); expect(report.complete).toBeTrue();
        expect(report.providerAccounting).toMatchObject({requests: 32, maximum: 32, accounted: 32, totalTokens: 3520});
        expect(report.accounting).toMatchObject({reserved: 32, unattempted: 0, unknownUsageReservations: 0, monetaryCost: {status: 'unpriced'}});
        expect(report.arms.baseline.passed).toBe(16); expect(report.arms.candidate.passed).toBe(16);
        expect(report.arms.candidate.infographicSelections).toBe(3); expect(report.paired.bothPass).toBe(16);
        expect(report.promotion.promoted).toBeFalse(); expect(report.scope.noCrossModelComparison).toBeTrue();
        for (let slot = 1; slot <= 32; slot++) for (const kind of ['request', 'response', 'result'] as const)
            expect(existsSync(join(path, attemptName(slot, kind)))).toBeTrue();
        const repeated = await run(path, reference.provider);
        expect(reference.calls()).toBe(32); expect(repeated.reportFile).toBe(report.reportFile);
        const budget = new ProviderRequestBudget(join(path, 'budget.sqlite'), 32);
        try {expect(() => budget.reserve('extra')).toThrow('exhausted'); expect(budget.reservations()).toHaveLength(32);}
        finally {budget.close();}
        expect(existsSync(join(path, 'pilot.lock'))).toBeFalse();
    });

    test('retains inappropriate choices and invalid output without repairs, retries or silent fallback', async () =>
    {
        const reference = referenceProvider((index, response) => index === 2 ? responseFor('{"representation":"infographic:process"}')
            : index === 3 ? responseFor('not-json') : response);
        const report = await run(root(), reference.provider);
        expect(reference.calls()).toBe(32); expect(report.complete).toBeTrue();
        expect(report.arms.candidate).toMatchObject({passed: 14, selectionErrors: 2, invalidOutput: 1, inappropriateInfographics: 1, repairs: 0, executedFallbacks: 0});
        expect(report.paired).toMatchObject({bothPass: 14, baselineOnly: 2, candidateOnly: 0});
    });

    test('keeps incomplete usage separate from selection failure and unknown usage is never free', async () =>
    {
        const reference = referenceProvider((index, response) => index === 1 ? {...response, status: 'incomplete'}
            : index === 2 ? {...response, usage: undefined} : response);
        const report = await run(root(), reference.provider);
        expect(report.complete).toBeFalse(); expect(report.arms.baseline.incomplete).toBe(1);
        expect(report.accounting.unknownUsageReservations).toBe(1);
        expect(report.providerAccounting).toMatchObject({requests: 32, accounted: 31, totalTokens: 3410});
        expect(report.attempts[0]).toMatchObject({outcome: 'incomplete', choice: null, usage: {totalTokens: 110}});
        expect(report.attempts[1]!.usage).toBeNull(); expect(report.accounting.monetaryCost.status).toBe('unpriced');
    });

    test('stops after a provider error, preserves safe diagnostics and does not replay that failed slot on resume', async () =>
    {
        const path = root(); let failures = 0;
        const report = await run(path, async () => {failures++; throw Object.assign(new Error(`Rejected ${configuration.apiKey} ${configuration.model}`),
            {status: 400, code: 'invalid_schema', headers: {authorization: configuration.apiKey}});});
        expect(failures).toBe(1); expect(report.accounting).toMatchObject({reserved: 1, unattempted: 31, unknownUsageReservations: 1});
        const encoded = readFileSync(join(path, attemptName(1, 'result')), 'utf8');
        expect(encoded).not.toContain(configuration.apiKey); expect(encoded).not.toContain(configuration.model); expect(encoded).not.toContain('headers');
        expect(encoded).toContain('invalid_schema');
        const reference = referenceProvider(); const resumed = await run(path, reference.provider);
        expect(reference.calls()).toBe(31); expect(resumed.accounting.reserved).toBe(32); expect(resumed.complete).toBeFalse();
        expect(existsSync(join(path, report.reportFile))).toBeTrue(); expect(existsSync(join(path, resumed.reportFile))).toBeTrue();
    });

    test('recovers a durably received response after interrupted grading without another request or overwriting history', async () =>
    {
        const path = root(); const reference = referenceProvider(); const first = await run(path, reference.provider);
        unlinkSync(join(path, attemptName(32, 'result'))); // Own disposable fixture, simulating response persisted before grading.
        const recovered = await run(path, reference.provider);
        expect(reference.calls()).toBe(32); expect(recovered.attempts[31]!.recovered).toBeTrue();
        expect(recovered.complete).toBeTrue(); expect(recovered.reportFile).not.toBe(first.reportFile);
        expect(existsSync(join(path, first.reportFile))).toBeTrue();
    });

    test('ambiguous reserved-but-unrecorded attempts stay unknown and are never resent', async () =>
    {
        const path = root(); const reference = referenceProvider(); await run(path, reference.provider);
        unlinkSync(join(path, attemptName(32, 'result'))); unlinkSync(join(path, attemptName(32, 'response')));
        const report = await run(path, reference.provider);
        expect(reference.calls()).toBe(32); expect(report.attempts[31]).toMatchObject({outcome: 'interrupted', choice: null, usage: null});
        expect(report.complete).toBeFalse(); expect(report.accounting.unknownUsageReservations).toBe(1);
    });

    test('binds approval to protocol/data/model, prevents concurrent execution and refuses symlinked records', async () =>
    {
        const path = root(); const reference = referenceProvider(); await run(path, reference.provider);
        await expect(run(path, reference.provider, {configuration: {...configuration, model: 'different-test-model'}})).rejects.toThrow('manifest changed');
        expect(reference.calls()).toBe(32);
        const journal = new SelectionJournal(path, configuration);
        try
        {
            expect(() => new SelectionJournal(path, configuration)).toThrow();
            expect(() => journal.write('manifest.json', {})).toThrow();
            symlinkSync(join(path, 'manifest.json'), join(path, 'alias.json'));
            expect(() => journal.read('alias.json')).toThrow('Invalid journal file');
        }
        finally {journal.close();}
    });

    test('stored response/model/error values are sanitized; no schema or data payload leaks the key', async () =>
    {
        const path = root(); await run(path, referenceProvider().provider);
        for (const file of readdirSync(path).filter((name) => name.endsWith('.json')))
        {
            const encoded = readFileSync(join(path, file), 'utf8');
            expect(encoded).not.toContain(configuration.apiKey); expect(encoded).not.toContain(configuration.model);
        }
        const response = JSON.parse(readFileSync(join(path, attemptName(1, 'response')), 'utf8'));
        expect(response.body.model).toBe('[configured]'); expect(response.responseModelFingerprint).toMatch(/^[a-f0-9]{64}$/);
    });

    test('the real SDK transport sends exactly once on 429; automatic HTTP retries are disabled', async () =>
    {
        let requests = 0;
        const provider = selectionProvider(configuration.apiKey, configuration.model, (async () =>
        {requests++; return new Response(JSON.stringify({error: {message: 'Rate limited', type: 'rate_limit_error'}}), {status: 429, headers: {'content-type': 'application/json'}});}) as unknown as typeof fetch);
        await expect(provider(selectionRequest(benchmark.pairs[0]!, 'baseline'), new AbortController().signal)).rejects.toThrow();
        expect(requests).toBe(1);
    });

    test('rejects malformed token accounting instead of inferring free or complete usage', () =>
    {
        expect(selectionUsage(responseFor('{}', {usage: undefined}))).toBeNull();
        const response = responseFor('{}'); response.usage!.total_tokens = 1;
        expect(selectionUsage(response)).toBeNull();
        const partial = responseFor('{}'); delete (partial.usage as {input_tokens_details?: unknown}).input_tokens_details;
        expect(selectionUsage(partial)).toBeNull();
    });

    test('CLI requires both billable switches before reading credentials or creating a ledger', async () =>
    {
        for (const [flag, args] of [['0', ['--confirm-billable']], ['1', []]] as const)
        {
            const child = Bun.spawn([process.execPath, '--no-env-file', resolve('scripts/eval-presentation-live.ts'), ...args],
                {env: {...process.env, NLUI_PRESENTATION_LIVE: flag, OPENAI_API_KEY: '', CHAT_MODEL: ''}, stdout: 'pipe', stderr: 'pipe'});
            const [out, error, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
            expect(exit, error).toBe(0); expect(JSON.parse(out)).toMatchObject({billable: false, approvedMaximum: 32});
        }
    });
});
