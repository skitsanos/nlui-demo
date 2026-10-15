import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import manifest from '../../data/fixture-manifest.json';
import {DATASET_ID, DATASET_REFERENCE_DATE, DATASET_VERSION} from '../data/constants.ts';
import {createDemoRepository, resetDemoDatabase} from '../data/index.ts';
import type {ToolDataSource} from '../nlui/toolTypes.ts';
import {traceFailureOutcome} from '../services/traceAccounting.ts';
import {abortable} from '../utils/abort.ts';
import {inspectEvaluationDataset} from './datasetState.ts';
import {captureFixtureState} from './fixtureState.ts';
import {createRouteExecutor} from './routeExecutor.ts';
import {executionFor} from './scenario.ts';
import type {ScenarioExecutor} from './types.ts';

export const createIsolatedExecutor = (factory: (data: ToolDataSource) => ScenarioExecutor): ScenarioExecutor =>
    async (context) =>
    {
        const root = mkdtempSync(join(tmpdir(), 'nlui-evaluation-run-'));
        let data: ToolDataSource | undefined;
        try
        {
            const databasePath = join(root, 'demo.sqlite');
            resetDemoDatabase({databasePath});
            const initial = inspectEvaluationDataset(databasePath);
            if (initial.fingerprint !== manifest.baselineFingerprint) throw new Error('Evaluation fixture differs from its versioned manifest');
            const before = captureFixtureState(databasePath);
            data = {databasePath, repository: createDemoRepository({databasePath})};
            const execute = executionFor(context.scenario).mode === 'route' ? createRouteExecutor(data) : factory(data);
            const startedAt = new Date().toISOString();
            const started = performance.now();
            const trace = await abortable(() => execute(context), context.signal).catch((error: unknown) => ({
                traceVersion: 2 as const, outcome: traceFailureOutcome(error, context.signal), scenarioId: context.scenario.id, runId: context.runId,
                startedAt, completedAt: new Date().toISOString(), events: [], toolCalls: [], blocks: [], responseIds: [], text: '',
                latency: {totalMs: performance.now() - started}, error: error instanceof Error ? error.message : 'Scenario adapter failed'
            }));
            const after = captureFixtureState(databasePath);
            const final = inspectEvaluationDataset(databasePath);
            const allowMutation = executionFor(context.scenario).mode === 'route';
            return {...trace, fixture: {id: DATASET_ID, version: DATASET_VERSION, snapshot: DATASET_REFERENCE_DATE,
                baselineFingerprint: initial.baselineFingerprint, initialFingerprint: initial.fingerprint,
                finalFingerprint: final.fingerprint, before, after,
                unexpectedMutation: !allowMutation && before.businessFingerprint !== after.businessFingerprint}};
        }
        finally
        {
            data?.repository.close();
            rmSync(root, {recursive: true, force: true});
        }
    };
