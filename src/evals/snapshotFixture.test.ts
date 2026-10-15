import {Database} from 'bun:sqlite';
import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import manifest from '../../data/fixture-manifest.json';
import {DATASET_ID, DATASET_REFERENCE_DATE, DATASET_SEED, DATASET_VERSION} from '../data/constants.ts';
import {queryDataset, queryParameterizedDataset} from '../data/queryDataset.ts';
import type {DatasetQueryResult} from '../data/queryTypes.ts';
import {createDemoRepository} from '../data/repository.ts';
import {ensureDemoDatabase, resetDemoDatabase} from '../data/seed.ts';
import {compileSemanticQuery, type SemanticQuery} from '../data/semantic/index.ts';
import {semanticPresentationFor} from '../nlui/semanticPresentation.ts';
import {renderDatasetResult} from '../nlui/toolHandlers/queryDataset.ts';
import {executeNluiTool} from '../nlui/tools.ts';
import {inspectEvaluationDataset} from './datasetState.ts';
import {evaluateTrace} from './evaluate.ts';
import {adaptScenarioForArm, type QueryExperimentArm} from './queryExperiment.ts';
import {loadEvaluationScenarios} from './scenario.ts';
import type {EvaluationTrace} from './types.ts';

let directory: string;
let databasePath: string;
beforeAll(() =>
{
    directory = mkdtempSync(join(tmpdir(), 'nlui-snapshot-fixture-'));
    databasePath = join(directory, 'demo.sqlite');
    resetDemoDatabase({databasePath});
});
afterAll(() => {if (directory) rmSync(directory, {recursive: true, force: true});});

const usingDatabase = <T>(path: string, callback: (database: Database) => T, readonly = true): T =>
{
    const database = new Database(path, {readonly, strict: true});
    try {return callback(database);}
    finally {database.close();}
};
const tuples = (result: DatasetQueryResult) => result.rows.map((row) => result.columns.map(({key}) => row[key]));

describe('versioned snapshot fixture', () =>
{
    test('binds metadata, SQLite version, golden files and logical fingerprint to v2', async () =>
    {
        expect(manifest).toMatchObject({datasetId: DATASET_ID, datasetVersion: DATASET_VERSION,
            seed: DATASET_SEED, referenceDate: DATASET_REFERENCE_DATE});
        expect(DATASET_VERSION).toBe(2);
        usingDatabase(databasePath, (database) =>
        {
            expect(database.query('PRAGMA user_version').get()).toEqual({user_version: 2});
            const metadata = Object.fromEntries(database.query<{key: string; value: string}, []>(
                'SELECT key, value FROM dataset_metadata').all().map(({key, value}) => [key, value]));
            expect(metadata).toEqual({dataset_id: manifest.datasetId, dataset_version: String(manifest.datasetVersion),
                reference_date: manifest.referenceDate, seed: String(manifest.seed)});
        });
        expect(inspectEvaluationDataset(databasePath)).toEqual({fingerprint: manifest.baselineFingerprint,
            baselineFingerprint: manifest.baselineFingerprint, isBaseline: true});
        const repeatPath = join(directory, 'repeat.sqlite');
        resetDemoDatabase({databasePath: repeatPath});
        expect(inspectEvaluationDataset(repeatPath).fingerprint).toBe(manifest.baselineFingerprint);
        for (const fixture of manifest.goldenFixtures)
        {
            const hash = new Bun.CryptoHasher('sha256').update(await Bun.file(join('data', fixture.path)).arrayBuffer()).digest('hex');
            expect(hash).toBe(fixture.sha256);
        }
        const scenarios = await loadEvaluationScenarios();
        const count = scenarios.find(({id}) => id === 'analytics-customer-count')!;
        expect(count.deterministicAssertions?.find((assertion) => assertion.source === 'tool' && assertion.path === 'datasetId'))
            .toMatchObject({expected: DATASET_ID});
    });

    test('scans every persisted observed timestamp column, retaining forecast dates', () =>
    {
        usingDatabase(databasePath, (database) =>
        {
            const tables = ['customers', 'orders', 'payments', 'shipments', 'returns', 'support_cases'];
            let observedColumns = 0;
            for (const table of tables)
            {
                const columns = database.query<{name: string}, []>(`PRAGMA table_info(${table})`).all()
                    .filter(({name}) => name.endsWith('_at') && name !== 'expected_delivery_at');
                for (const {name} of columns)
                {
                    observedColumns++;
                    expect(database.query(`SELECT COUNT(*) AS n FROM ${table}
                        WHERE ${name} IS NOT NULL AND (julianday(${name}) IS NULL OR ${name} > ?)`).get(DATASET_REFERENCE_DATE))
                        .toEqual({n: 0});
                }
            }
            expect(observedColumns).toBe(9);
            expect(database.query(`SELECT COUNT(*) AS n FROM shipments WHERE expected_delivery_at > ?`)
                .get(DATASET_REFERENCE_DATE)).toEqual({n: 15});
            expect(database.query<{n: number}, [string]>(`SELECT COUNT(*) AS n FROM shipments WHERE delivered_at = ?`)
                .get(DATASET_REFERENCE_DATE)!.n).toBeGreaterThan(0);
            expect(database.query<{n: number}, [string]>(`SELECT COUNT(*) AS n FROM returns WHERE requested_at = ?`)
                .get(DATASET_REFERENCE_DATE)!.n).toBeGreaterThan(0);
        });
    });

    test('refuses an earlier fixture without replacing its records or file contents', async () =>
    {
        const oldPath = join(directory, 'legacy.sqlite');
        resetDemoDatabase({databasePath: oldPath});
        usingDatabase(oldPath, (database) =>
        {
            database.run("UPDATE dataset_metadata SET value = 'nlui-retail-operations-v1' WHERE key = 'dataset_id'");
            database.run("UPDATE dataset_metadata SET value = '1' WHERE key = 'dataset_version'");
            database.run('PRAGMA user_version = 1');
            database.run("UPDATE orders SET shipping_line1 = 'Retained local edit' WHERE id = 1176");
            database.run('PRAGMA wal_checkpoint(TRUNCATE)');
        }, false);
        const before = new Bun.CryptoHasher('sha256').update(await Bun.file(oldPath).arrayBuffer()).digest('hex');
        expect(() => ensureDemoDatabase({databasePath: oldPath})).toThrow('Refusing to replace');
        expect(() => inspectEvaluationDataset(oldPath)).toThrow('Refusing to replace');
        expect(new Bun.CryptoHasher('sha256').update(await Bun.file(oldPath).arrayBuffer()).digest('hex')).toBe(before);
        usingDatabase(oldPath, (database) =>
        {
            expect(database.query('SELECT shipping_line1 FROM orders WHERE id = 1176').get())
                .toEqual({shipping_line1: 'Retained local edit'});
            expect(database.query('PRAGMA user_version').get()).toEqual({user_version: 1});
        });
    });

    test('preserves the stable demo actions and latest gold-customer answer', async () =>
    {
        const repository = createDemoRepository({databasePath});
        try
        {
            expect(repository.getOrder(1042)?.shipment?.deliveredAt).toBe('2026-06-22T10:30:00.000Z');
            expect(repository.getOrder(1176)?.status).toBe('processing');
            expect(repository.getOrder(1320)?.status).toBe('delayed');
            expect(repository.getOrder(2088)?.status).toBe('delayed');
            const prepared = repository.prepareAction({type: 'return_order', orderNumber: 'ORD-1042', reason: 'Fixture regression'});
            expect(prepared.actionType).toBe('return_order');
        }
        finally {repository.close();}
        const latest = await queryDataset("SELECT MAX(joined_at) AS joined_at FROM customers WHERE tier = 'gold'", {databasePath});
        expect(tuples(latest)).toEqual([['2025-12-14T12:00:00.000Z']]);
        // Preparation is an intentional isolated mutation, never a new baseline.
        expect(inspectEvaluationDataset(databasePath).isBaseline).toBeFalse();
        resetDemoDatabase({databasePath});
        expect(inspectEvaluationDataset(databasePath).isBaseline).toBeTrue();
    });

    test('selects isolated fixtures only through trusted context, not model arguments', async () =>
    {
        const repository = createDemoRepository({databasePath});
        try
        {
            const data = {databasePath, repository};
            const args = {sql: 'SELECT COUNT(*) AS customer_count FROM customers', title: 'Customers', presentation: 'metric'};
            const result = await executeNluiTool('query_dataset', JSON.stringify(args), undefined, data);
            expect(result.modelOutput).toMatchObject({datasetId: DATASET_ID, snapshotAsOf: DATASET_REFERENCE_DATE,
                rows: [{c0: 200}]});
            expect(result.modelOutput).not.toHaveProperty('databasePath');
            const order = await executeNluiTool('get_order', JSON.stringify({order_number: 'ORD-1042'}), undefined, data);
            expect(order.modelOutput).toMatchObject({found: true, order: {orderNumber: 'ORD-1042', status: 'delivered'}});
            const injected = await executeNluiTool('query_dataset', JSON.stringify({...args, databasePath: 'not-authorized.sqlite'}),
                undefined, data);
            expect(injected.modelOutput).toMatchObject({ok: false});
            expect(injected.blocks).toEqual([]);
            const controller = new AbortController();
            controller.abort();
            await expect(executeNluiTool('query_dataset', JSON.stringify(args), controller.signal, data))
                .rejects.toBe(controller.signal.reason);
        }
        finally {repository.close();}
    });
});

const cases: Record<string, {sql: string; plan: SemanticQuery}> = {
    'registered-customer-count': {
        sql: 'SELECT COUNT(*) AS customer_count FROM customers',
        plan: {metric: 'registered_customer_count', dimensions: [], filters: []}
    },
    'registered-customers-by-tier': {
        sql: 'SELECT tier, COUNT(*) AS customer_count FROM customers GROUP BY tier ORDER BY customer_count DESC',
        plan: {metric: 'registered_customer_count', dimensions: ['customer_tier'], filters: [],
            orderBy: {field: 'metric', direction: 'desc'}}
    },
    'eligible-revenue-by-tier-2026': {
        sql: `SELECT c.tier, ROUND(SUM(o.total_cents) / 100.0, 2) AS revenue_eur
            FROM orders o JOIN customers c ON o.customer_id = c.id
            WHERE o.created_at >= '2026-01-01' AND o.created_at <= '${DATASET_REFERENCE_DATE}'
            AND o.status NOT IN ('cancelled', 'returned') GROUP BY c.tier ORDER BY revenue_eur DESC`,
        plan: {metric: 'eligible_revenue_eur', dimensions: ['customer_tier'], filters: [],
            timeRange: {from: '2026-01-01', to: DATASET_REFERENCE_DATE.slice(0, 10)},
            orderBy: {field: 'metric', direction: 'desc'}}
    }
};

describe('provider-free golden semantic comparison on fixture v2', () =>
{
    for (const [caseId, input] of Object.entries(cases))
    {
        test(`rechecks both query arms and all paraphrase expectations for ${caseId}`, async () =>
        {
            const scenarios = (await loadEvaluationScenarios(join('data', 'experiments', 'semantic-query-v1.jsonl')))
                .filter((scenario) => scenario.experiment?.caseId === caseId);
            expect(scenarios).toHaveLength(3);
            const compiled = compileSemanticQuery(input.plan);
            expect(compileSemanticQuery(input.plan).planHash).toBe(compiled.planHash);
            const control = await queryDataset(input.sql, {databasePath});
            const semantic = await queryParameterizedDataset(compiled.sql, compiled.parameters, {databasePath});
            expect(tuples(semantic)).toEqual(tuples(control));
            expect((await queryDataset(input.sql, {databasePath})).queryHash).toBe(control.queryHash);
            for (const arm of ['control', 'semantic'] as QueryExperimentArm[])
            {
                const result = arm === 'control' ? control : semantic;
                const presentation = arm === 'control' ? 'auto' : semanticPresentationFor(compiled.plan, result).presentation;
                const rendered = renderDatasetResult(result, 'Snapshot fixture regression', presentation);
                for (const scenario of scenarios)
                {
                    const tool = arm === 'control' ? 'query_dataset' : 'semantic_query';
                    const trace: EvaluationTrace = {
                        scenarioId: scenario.id, runId: `${scenario.id}:1:${arm}`,
                        startedAt: DATASET_REFERENCE_DATE, completedAt: DATASET_REFERENCE_DATE,
                        events: [], text: 'A synthetic dataset result as of the snapshot.', toolCalls: [tool],
                        toolExecutions: [{round: 1, callId: `${arm}-fixture`, name: tool,
                            arguments: arm === 'control' ? {sql: input.sql} : {plan: input.plan},
                            modelOutput: rendered.traceOutput, candidateBlockIds: rendered.blocks.map(({id}) => id),
                            candidateBlockTypes: rendered.blocks.map(({type}) => type), durationMs: 1, cached: false, rejected: false}],
                        blocks: rendered.blocks, responseIds: [], latency: {totalMs: 1}
                    };
                    const graded = await evaluateTrace(adaptScenarioForArm(scenario, arm), trace);
                    expect(graded.status).toBe('passed');
                    expect(graded.dataAssertions.every(({status}) => status === 'passed')).toBeTrue();
                }
            }
        });
    }
});
