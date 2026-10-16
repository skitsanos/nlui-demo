import {Database} from 'bun:sqlite';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {createDemoRepository, DATASET_ID, DATASET_VERSION } from '../../data/index.ts';
import {presentationCanaries} from './canaries.ts';
import {PRESENTATION_BENCHMARK_VERSION, PRESENTATION_CASES, type PresentationCase, REPRESENTATIONS } from './cases.ts';
import {eligibleRepresentations, gradePresentation} from './grade.ts';
import {evidenceHash, type PresentationEvidence, presentationEvidence} from './oracle.ts';
import {candidateSelection, controlledSelection, type PresentationSelection} from './selection.ts';

export interface MatchedPresentation
{
    task: PresentationCase;
    evidence: PresentationEvidence;
    baseline: PresentationSelection;
    candidate: PresentationSelection;
}
export const runPresentationBenchmark = async () =>
{
    const root = await mkdtemp(join(tmpdir(), 'nlui-presentation-'));
    const databasePath = join(root, 'demo.sqlite');
    let repository: ReturnType<typeof createDemoRepository> | undefined; let database: Database | undefined;
    try
    {
        repository = createDemoRepository({databasePath});
        database = new Database(databasePath, {readonly: true});
        const connection = database;
        const started = performance.now(); const pairs: MatchedPresentation[] = []; const results = [];
        const state = () => evidenceHash(['dataset_metadata', 'customers', 'products', 'orders', 'order_items', 'payments',
            'shipments', 'returns', 'support_cases', 'policy_documents', 'pending_actions', 'activity_log']
            .map((table) => [table, connection.query(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
        const before = state();
        for (const task of PRESENTATION_CASES)
        {
            const evidence = presentationEvidence(task, database);
            const begin = performance.now(); const baseline = controlledSelection(task, evidence);
            const baselineMs = performance.now() - begin;
            const candidateBegin = performance.now(); const candidate = await candidateSelection(task, evidence, {repository, databasePath});
            const candidateMs = performance.now() - candidateBegin;
            pairs.push({task, evidence, baseline, candidate});
            const measurement = (selection: PresentationSelection, ms: number, arm: 'baseline' | 'candidate') => ({
                selection: selection.representation, ...gradePresentation(task, evidence, selection, arm),
                constructionMs: ms, serializedBytes: Buffer.byteLength(JSON.stringify(selection))
            });
            results.push({id: task.id, evidenceHash: evidenceHash(evidence),
                baseline: measurement(baseline, baselineMs, 'baseline'), candidate: measurement(candidate, candidateMs, 'candidate'),
                eligibility: REPRESENTATIONS.map((representation) => ({representation,
                    baseline: eligibleRepresentations(task, 'baseline').includes(representation),
                    candidate: eligibleRepresentations(task, 'candidate').includes(representation)}))});
        }
        const after = state();
        const canaries = presentationCanaries(pairs);
        const negativeControls = pairs.filter(({task}) => task.baseline === task.candidate).flatMap((pair) =>
            pairs.filter(({task}) => task.candidate.startsWith('infographic:')).map(({candidate}) => ({caseId: pair.task.id,
                representation: candidate.representation, ...gradePresentation(pair.task, pair.evidence, {...candidate,
                    context: pair.baseline.context, caption: pair.task.caption}, 'candidate')})));
        const report = {version: PRESENTATION_BENCHMARK_VERSION, caseFingerprint: evidenceHash(PRESENTATION_CASES),
            runtime: Bun.version, dataset: {id: DATASET_ID, version: DATASET_VERSION, before, after, unchanged: before === after},
            boundary: 'Authored reference selections; raw SQLite/full-policy oracle. Construction timings exclude browser, network, model and humans.',
            constructionTimingCaveat: 'Baseline projects preloaded oracle data; eligible candidate calls the real tool, including its query and validation. These construction timings are not equal-work latency comparisons.',
            accounting: {providerRequests: 0, usage: 'not_applicable', monetaryCost: 'not_applicable', repairs: 0,
                liveModelSelection: 'not_run', humanStudy: 'not_run', observedBrowserFallbacks: 'recorded_separately'},
            decision: 'no_promotion', results, canaries, negativeControls,
            summary: {matchedCases: results.length, eligibleInfographicCases: pairs.filter(({task}) => task.candidate.startsWith('infographic:')).length,
                baselineReferenceFailures: results.filter(({baseline}) => !baseline.passed).length,
                candidateReferenceFailures: results.filter(({candidate}) => !candidate.passed).length,
                injectedFailuresDetected: canaries.filter(({passed}) => !passed).length,
                wrongInfographicsRejected: negativeControls.filter(({errors}) => errors.includes('ineligible_representation')).length},
            totalConstructionMs: performance.now() - started};
        return {report, pairs};
    }
    finally {database?.close(true); repository?.close(); await rm(root, {recursive: true, force: true});}
};
