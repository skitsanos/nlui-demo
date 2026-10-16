import {beforeAll, describe, expect, test} from 'bun:test';
import {resolve} from 'node:path';
import frozenReport from '../../../docs/issues/reviews/assets/2026-10-16-fallback-v2-report.json';
import {runPresentationBenchmark} from './benchmark.ts';
import {REPRESENTATIONS, type Representation} from './cases.ts';
import {FALLBACK_CONTRACT_VERSION, FALLBACK_INSTRUCTIONS, FALLBACK_RULES, type FallbackArm, type FallbackContext, fallbackCatalog, fallbackContextSchema, fallbackDecision} from './fallbackContract.ts';
import {FALLBACK_FIXTURES} from './fallbackFixtures.ts';
import {fallbackChoiceSchema, fallbackPrompt, fallbackProtocolFingerprint, gradeFallbackChoice} from './fallbackProtocol.ts';
import {gradeLiveChoice, selectionProtocolFingerprint} from './liveProtocol.ts';

let benchmark: Awaited<ReturnType<typeof runPresentationBenchmark>>;
beforeAll(async () => {benchmark = await runPresentationBenchmark();});
const pairFor = (id: string) => benchmark.pairs.find(({task}) => task.id === id)!;
const contextFor = (id: string) => FALLBACK_FIXTURES.find((item) => item.id === id)!.context;
const encoded = (representation: Representation) => JSON.stringify({representation});
// Independent literal expectations, not generated from either protocol's labels or rule table.
const expected: Record<string, readonly [Representation, Representation]> = {
    'customer-count': ['stats', 'stats'], 'latest-customers': ['table', 'table'], 'monthly-revenue': ['chart', 'chart'],
    'regional-comparison': ['chart', 'infographic:comparison'], 'order-history': ['table', 'infographic:timeline'],
    'return-policy': ['sources', 'infographic:process'], ambiguous: ['message', 'message'], 'missing-order': ['result', 'result'],
    'empty-customers': ['table', 'table'], 'zero-revenue': ['table', 'table'], 'future-forecast': ['message', 'message'],
    causality: ['message', 'message'], 'order-eligibility': ['message', 'message'], 'incompatible-scope': ['message', 'message'],
    'adversarial-label': ['table', 'table'], 'explicit-line': ['chart', 'chart']
};

describe('versioned unavailable-format fallback contract (no provider)', () =>
{
    for (const [id, [baseline, candidate]] of Object.entries(expected)) test(`${id}: exact eligibility and both faithful references`, () =>
    {
        const pair = pairFor(id); const context = contextFor(id);
        for (const arm of ['baseline', 'candidate'] as const)
        {
            const eligible = arm === 'baseline' || baseline === candidate ? [baseline] : [baseline, candidate];
            expect(fallbackDecision(context, arm).eligible).toEqual(eligible);
            expect(fallbackDecision(context, arm).preferred).toBe(arm === 'baseline' ? baseline : candidate);
            for (const kind of REPRESENTATIONS)
            {
                const grade = gradeFallbackChoice(pair, context, arm, encoded(kind));
                expect(grade.passed, `${arm}:${kind}`).toBe(eligible.includes(kind));
                if (!eligible.includes(kind)) expect(grade.errors).toContain(arm === 'baseline' && kind.startsWith('infographic:')
                    ? 'outside_arm_catalog' : 'ineligible_representation');
            }
        }
    });

    test('visual requests use exact fallbacks, not clarification solely because a renderer is absent', () =>
    {
        for (const [id, kind] of [['regional-comparison', 'chart'], ['order-history', 'table'], ['return-policy', 'sources']] as const)
        {
            expect(gradeFallbackChoice(pairFor(id), contextFor(id), 'baseline', encoded(kind)).passed).toBeTrue();
            expect(gradeFallbackChoice(pairFor(id), contextFor(id), 'baseline', encoded('message')).passed).toBeFalse();
            expect(gradeFallbackChoice(pairFor(id), contextFor(id), 'candidate', encoded(kind)).passed).toBeTrue();
        }
    });

    test('does not decorate nonvisual requests, zero totals, unknown lookups or unsupported scope/evidence', () =>
    {
        const controls: [FallbackContext, Representation][] = [
            [{kind: 'recorded-history', visual: false}, 'table'], [{kind: 'general-policy', visual: false}, 'sources'],
            [{kind: 'binary-revenue', visual: false, totals: 'nonzero'}, 'chart'],
            [{kind: 'binary-revenue', visual: true, totals: 'both-zero'}, 'table']
        ];
        for (const [context, kind] of controls) for (const arm of ['baseline', 'candidate'] as const)
            expect(fallbackDecision(context, arm).eligible).toEqual([kind]);
        for (const blocker of ['scope', 'forecast', 'cause', 'eligibility', 'format-scope', 'unverified-lookup'] as const)
            for (const arm of ['baseline', 'candidate'] as const)
                expect(fallbackDecision({kind: 'clarify', blocker}, arm).eligible).toEqual(['message']);
    });

    test('distinguishes verified absence, successful empty lists and exact zeros without inventing action success', () =>
    {
        const missing = pairFor('missing-order'); const context = contextFor('missing-order');
        expect(fallbackDecision(context, 'candidate').eligible).toEqual(['result']);
        expect(fallbackDecision(contextFor('empty-customers'), 'candidate').eligible).toEqual(['table']);
        expect(fallbackDecision(contextFor('zero-revenue'), 'candidate').eligible).toEqual(['table']);
        expect(gradeFallbackChoice(missing, context, 'candidate', encoded('message')).passed).toBeFalse();
        const fake = structuredClone(missing.baseline);
        if (fake.blocks[0]?.type === 'result') fake.blocks[0].status = 'success';
        expect(gradeFallbackChoice(missing, context, 'candidate', encoded('result'), [fake]).errors).toContain('result_contract');
    });

    test('fails closed on invalid or ambiguous fixture facts and unknown choices', () =>
    {
        for (const context of [{kind: 'missing-record'}, {kind: 'missing-record', lookup: 'unknown'},
            {kind: 'general-policy', visual: true, action: 'refund'}, {kind: 'binary-revenue', visual: true, totals: 'unknown'},
            {kind: 'unknown'}, {kind: 'series', format: 'binary'}])
        {
            expect(fallbackContextSchema.safeParse(context).success).toBeFalse();
            expect(() => fallbackDecision(context as FallbackContext, 'candidate')).toThrow();
            expect(gradeFallbackChoice(pairFor('customer-count'), context as FallbackContext, 'candidate', encoded('stats')).passed).toBeFalse();
        }
        for (const output of ['{}', 'null', 'not JSON', '{"representation":"unknown"}', '{"representation":"stats","action":"refund"}'])
            expect(gradeFallbackChoice(pairFor('customer-count'), contextFor('customer-count'), 'candidate', output).passed).toBeFalse();
        expect(gradeFallbackChoice(pairFor('order-history'), contextFor('order-history'), 'candidate', encoded('table'), [])
            .errors).toEqual(['unavailable_descriptor']);
    });

    test('uses the same explicit rules in instructions, both catalogs and executable eligibility', () =>
    {
        expect(FALLBACK_CONTRACT_VERSION).toBe('presentation-fallback-v2');
        expect(FALLBACK_INSTRUCTIONS).not.toContain('If scope is insufficient or the requested format is incompatible, ask a clarification');
        expect(FALLBACK_INSTRUCTIONS).toContain('Do not ask a clarification merely because the catalog lacks an infographic.');
        expect(new Set(FALLBACK_RULES.map(({id}) => id)).size).toBe(FALLBACK_RULES.length);
        expect(fallbackCatalog('baseline').map(({kind}) => kind)).toEqual(['message', 'stats', 'table', 'chart', 'sources', 'result']);
        expect(fallbackCatalog('candidate').map(({kind}) => kind)).toEqual([...REPRESENTATIONS]);
        for (const rule of FALLBACK_RULES)
        {
            expect(FALLBACK_INSTRUCTIONS).toContain(rule.instruction);
            for (const arm of ['baseline', 'candidate'] as const)
                for (const entry of fallbackCatalog(arm).filter(({kind}) => kind === rule.existing || kind === rule.visual))
                    expect(entry.description).toContain(rule.instruction);
        }
        for (const arm of ['baseline', 'candidate'] as const)
            expect(fallbackChoiceSchema(arm)).toEqual({type: 'object', properties: {representation: {type: 'string',
                enum: fallbackCatalog(arm).map(({kind}) => kind)}}, required: ['representation'], additionalProperties: false});
    });

    test('withholds fixture facts, golden kinds, rationales and captions; arms share verified data only', () =>
    {
        const forbidden = ['baseline', 'candidate', 'reason', 'caption', 'eligible', 'preferred', 'rule', 'context', 'caseId'];
        const keys = (input: unknown): string[] => input && typeof input === 'object' ? Object.entries(input)
            .flatMap(([key, value]) => [key, ...keys(value)]) : [];
        for (const pair of benchmark.pairs)
        {
            const a = fallbackPrompt(pair, 'baseline'); const b = fallbackPrompt(pair, 'candidate');
            expect({...a.input, catalog: null}).toEqual({...b.input, catalog: null});
            expect(a.instructions).toBe(b.instructions);
            for (const key of forbidden) expect(keys(a.input)).not.toContain(key);
            const poisoned = {...pair, task: {...pair.task, reason: 'PRIVATE_RATIONALE', caption: 'PRIVATE_CAPTION',
                baseline: 'result' as const, candidate: 'message' as const}};
            expect(fallbackPrompt(poisoned, 'baseline')).toEqual(a);
            expect(JSON.stringify(a.input)).not.toContain(pair.task.reason);
            expect(JSON.stringify(a.input)).not.toContain(pair.task.caption);
        }
        expect(fallbackPrompt(pairFor('missing-order'), 'baseline').input.availability.recordLookup).toEqual({orderNumber: 'ORD-999999', found: false});
    });

    test('eligibility never waives independent exact-content, dates, units, ordering or policy conditions', () =>
    {
        const corrupt = (id: string, edit: (selected: typeof benchmark.pairs[number]['candidate']) => void, arm: FallbackArm = 'candidate') =>
        {
            const pair = pairFor(id); const selected = structuredClone(pair[arm]); edit(selected);
            expect(gradeFallbackChoice(pair, contextFor(id), arm, encoded(selected.representation), [selected]).passed, id).toBeFalse();
        };
        corrupt('order-history', (s) => {if (s.blocks[0]?.type === 'table') s.blocks[0].rows.pop();}, 'baseline');
        corrupt('order-history', (s) => {if (s.blocks[0]?.type === 'table') s.blocks[0].columns[1]!.format = 'text';}, 'baseline');
        corrupt('regional-comparison', (s) => {s.context.unit = 'USD';}, 'baseline');
        corrupt('regional-comparison', (s) => {if (s.blocks[0]?.type === 'chart') s.blocks[0].data[0]!.value = 1;}, 'baseline');
        corrupt('return-policy', (s) => {if (s.blocks[0]?.type === 'sources') s.blocks[0].items[3]!.excerpt = 'Unconditional refund.';}, 'baseline');
        corrupt('latest-customers', (s) => {if (s.blocks[0]?.type === 'table') s.blocks[0].rows.reverse();});
        corrupt('missing-order', (s) => {s.caption = 'Refund approved.';});
        corrupt('regional-comparison', (s) => {s.context.snapshot = '2027-01-01';});
    });

    test('versions the correction without changing v1 fingerprint or its three observed misses', () =>
    {
        expect(selectionProtocolFingerprint()).toBe('ba05cc7bdf5052e27fb339da2f3cf2432d56a5ea013c2771fb8629edf28e6751');
        expect(fallbackProtocolFingerprint()).toBe(frozenReport.protocolFingerprint);
        expect(fallbackProtocolFingerprint()).not.toBe(selectionProtocolFingerprint());
        expect(FALLBACK_FIXTURES.map(({id}) => id)).toEqual(Object.keys(expected));
        for (const id of ['order-history', 'return-policy', 'missing-order'])
            expect(gradeLiveChoice(pairFor(id), 'baseline', encoded('message')).passed).toBeFalse();
    });

    test('offline CLI completes with network denied and no credential values or new budget', async () =>
    {
        const script = resolve('scripts/eval-presentation-fallback.ts');
        const child = Bun.spawn([process.execPath, '--no-env-file', '-e',
            `globalThis.fetch=()=>{throw new Error("Network forbidden")}; await import(${JSON.stringify(script)});`],
        {env: {PATH: process.env.PATH!, OPENAI_API_KEY: '', CHAT_MODEL: ''}, stdout: 'pipe', stderr: 'pipe'});
        const [out, error, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
        expect(exit, error).toBe(0);
        const report = JSON.parse(out);
        expect(report).toEqual(frozenReport);
        expect(report.accounting).toEqual({providerRequests: 0, usage: 'not_applicable', monetaryCost: 'not_applicable', createdBudget: false});
        expect(report.qualification).toMatchObject({referenceOnly: true, promoted: false, liveVerification: 'pending_new_authorization', heldOutReplication: 'not_preregistered'});
        expect(report.dataset).toMatchObject({version: 2, unchanged: true});
        expect(report.cases).toHaveLength(16); expect(report.originalScoresUnchanged).toEqual({baseline: 13, candidate: 16, denominator: 16});
        for (const item of report.cases) for (const arm of item.arms) for (const grade of arm.referenceGrades) expect(grade.passed).toBeTrue();
        expect(JSON.stringify(report)).not.toContain('PRIVATE_');
    });
});
