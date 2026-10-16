import {beforeAll, describe, expect, test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {NluiRenderer} from '../../client/components/NluiRenderer.tsx';
import {resolveStructuredResponse} from '../../services/structuredResponse.ts';
import {runPresentationBenchmark} from './benchmark.ts';
import {PRESENTATION_CASES, REPRESENTATIONS} from './cases.ts';
import {eligibleRepresentations, gradePresentation} from './grade.ts';
import {evidenceHash} from './oracle.ts';
import {controlledSelection} from './selection.ts';

let result: Awaited<ReturnType<typeof runPresentationBenchmark>>;
beforeAll(async () => {result = await runPresentationBenchmark();});
describe('frozen presentation-selection benchmark', () =>
{
    test('pins task contracts, negative eligibility, fixture version and honest accounting', () =>
    {
        expect(result.report.version).toBe('presentation-v1');
        expect(result.report.caseFingerprint).toBe('82ab42df009114cbcc11d759c37bd5a781983a84fe04863b6dae65e27d12a063');
        expect(new Set(PRESENTATION_CASES.map(({id}) => id)).size).toBe(16);
        expect(result.report.dataset).toMatchObject({version: 2, unchanged: true});
        expect(result.report.dataset.before).toBe('4058b52984743515bdd8e6404708cdad1b3192d03279b3bc21ba5b239586377c');
        expect(result.report.accounting).toMatchObject({providerRequests: 0, usage: 'not_applicable', liveModelSelection: 'not_run', humanStudy: 'not_run', repairs: 0});
        expect(result.report.decision).toBe('no_promotion');
        expect(result.report.summary).toEqual({matchedCases: 16, eligibleInfographicCases: 3, baselineReferenceFailures: 0,
            candidateReferenceFailures: 0, injectedFailuresDetected: 24, wrongInfographicsRejected: 39});
    });

    for (const {id} of PRESENTATION_CASES) test(`${id}: matched content qualifies both reference arms, not model selection`, () =>
    {
        const pair = result.pairs.find(({task}) => task.id === id)!;
        for (const arm of ['baseline', 'candidate'] as const)
        {
            expect(gradePresentation(pair.task, pair.evidence, pair[arm], arm)).toEqual({passed: true, errors: []});
            expect(result.report.results.find((entry) => entry.id === id)![arm].serializedBytes).toBe(Buffer.byteLength(JSON.stringify(pair[arm])));
            expect(pair[arm].context).toEqual(pair.baseline.context);
        }
        for (const representation of REPRESENTATIONS.filter((r) => !eligibleRepresentations(pair.task, 'candidate').includes(r)))
            expect(gradePresentation(pair.task, pair.evidence, {...pair.candidate, representation}, 'candidate').errors).toContain('ineligible_representation');
    });

    test('rejects every semantic corruption even after content is rehashed', () =>
    {
        expect(result.report.canaries).toHaveLength(24);
        for (const canary of result.report.canaries) expect(canary.passed, canary.id).toBeFalse();
        expect(result.report.negativeControls).toHaveLength(39);
        for (const control of result.report.negativeControls) expect(control.errors).toContain('ineligible_representation');
    });

    test('renderer projections cannot mutate the oracle and object-key order does not change semantics', () =>
    {
        const pair = result.pairs.find(({task}) => task.id === 'latest-customers')!;
        const selection = controlledSelection(pair.task, pair.evidence);
        const block = selection.blocks[0];
        if (block?.type !== 'table') throw new Error('Expected controlled table');
        block.columns[0]!.label = 'Altered'; block.rows[0]!.tier = 'invented';
        expect(pair.evidence.columns[0]!.label).toBe('Customer');
        expect(pair.evidence.rows[0]!.tier).toBe('gold');
        expect(gradePresentation(pair.task, pair.evidence, selection, 'baseline').passed).toBeFalse();
        const reordered = {...pair.baseline, context: Object.fromEntries(Object.entries(pair.baseline.context).reverse()) as typeof pair.baseline.context};
        expect(gradePresentation(pair.task, pair.evidence, reordered, 'baseline').passed).toBeTrue();
        const chart = result.pairs.find(({task}) => task.id === 'monthly-revenue')!;
        const changed = controlledSelection(chart.task, chart.evidence).blocks[0];
        if (changed?.type === 'chart') changed.data[0]!.value = -1;
        expect(chart.evidence.rows[0]!.value).toBe(86320.99);
    });

    test('independently pins exact eligible revenue, count, zero versus absence, and full policy conditions', () =>
    {
        const evidence = (id: string) => result.pairs.find(({task}) => task.id === id)!.evidence;
        expect(evidence('customer-count').rows).toEqual([{label: 'Customers', value: 200}]);
        expect(evidence('regional-comparison').rows).toEqual([{label: 'West', value: 86554.26}, {label: 'East', value: 117577.77}]);
        expect(evidence('zero-revenue').rows).toEqual([{label: 'West', value: 0}, {label: 'East', value: 0}]);
        expect(evidence('empty-customers').rows).toEqual([]);
        expect(evidence('latest-customers').rows).toHaveLength(5);
        expect(evidence('return-policy').rows[3]!.detail).toContain('receives and inspects');
        expect(evidence('return-policy').rows[3]!.detail).toEndWith('unless the item was damaged or incorrect.');
    });

    test('issued timeline fingerprints reproduce after validation and JSON round trip', () =>
    {
        for (const pair of result.pairs)
            for (const block of JSON.parse(JSON.stringify(pair.candidate.blocks)) as typeof pair.candidate.blocks)
                if (block.type === 'infographic') expect(block.provenance.fingerprint).toBe(evidenceHash({scope: block.provenance.scope, items: block.items}));
    });

    test('strict response IDs do not establish task fit; the independent grader rejects a cross-case issued diagram', () =>
    {
        const fact = result.pairs[0]!; const diagram = result.pairs.find(({task}) => task.id === 'regional-comparison')!.candidate;
        const resolved = resolveStructuredResponse(JSON.stringify({presentation: 'blocks', answer: null, caption: diagram.caption,
            block_ids: diagram.blocks.map(({id}) => id)}), diagram.blocks);
        expect(resolved.blocks).toHaveLength(1);
        expect(gradePresentation(fact.task, fact.evidence, {...diagram, blocks: resolved.blocks}, 'candidate').passed).toBeFalse();
        expect(() => resolveStructuredResponse(JSON.stringify({presentation: 'blocks', answer: null, caption: diagram.caption, block_ids: ['invented']}), diagram.blocks)).toThrow();
    });

    test('actual controlled rendering escapes adversarial text, preserves dates/conditions and provides all exact infographic alternatives', () =>
    {
        const html = (id: string, arm: 'baseline' | 'candidate') => renderToStaticMarkup(<NluiRenderer
            blocks={result.pairs.find(({task}) => task.id === id)![arm].blocks} conversationId="presentation-test" onInteraction={async () => false}/>);
        expect(html('adversarial-label', 'baseline')).toContain('&lt;img');
        expect(html('adversarial-label', 'baseline')).not.toContain('<img src="x"');
        expect(html('latest-customers', 'baseline')).toContain('14 Dec 2025');
        expect(html('return-policy', 'baseline')).toContain('receives and inspects');
        for (const id of ['regional-comparison', 'order-history', 'return-policy'])
        {
            const markup = html(id, 'candidate');
            expect(markup).toContain('infographic-card'); expect(markup).not.toContain('Loading visual');
            expect(markup).toContain(id === 'regional-comparison' ? '€86,554.26' : id === 'order-history' ? 'Recorded event' : 'receives and inspects');
        }
    });
});
