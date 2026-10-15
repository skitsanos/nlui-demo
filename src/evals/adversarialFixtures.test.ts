import {Database} from 'bun:sqlite';
import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDemoRepository, resetDemoDatabase} from '../data/index.ts';
import {queryDataset} from '../data/queryDataset.ts';
import {inspectEvaluationDataset} from './datasetState.ts';
import {evaluateTrace} from './evaluate.ts';
import type {EvaluationScenario} from './scenario.ts';
import type {EvaluationTrace} from './types.ts';

let directory: string;
let databasePath: string;
beforeAll(() =>
{
    directory = mkdtempSync(join(tmpdir(), 'nlui-adversarial-variant-'));
    databasePath = join(directory, 'demo.sqlite');
    resetDemoDatabase({databasePath});
    const database = new Database(databasePath);
    try
    {
        // Explicit test-only variant v1, not the pinned baseline. Remove per-order
        // uniqueness only in this owned copy to exercise partial/multi-leg data.
        database.exec(`CREATE TABLE payment_legs AS SELECT * FROM payments;
            DROP TABLE payments; ALTER TABLE payment_legs RENAME TO payments;
            CREATE TABLE shipment_legs AS SELECT * FROM shipments;
            DROP TABLE shipments; ALTER TABLE shipment_legs RENAME TO shipments;
            UPDATE payments SET amount_cents = 10000, status = 'paid' WHERE order_id = 1042;
            INSERT INTO payments VALUES (9001,1042,'card','paid',2500,'2026-06-18T12:00:00Z');
            INSERT INTO payments VALUES (9002,1042,'card','refunded',3000,'2026-06-25T12:00:00Z');
            INSERT INTO shipments VALUES (9001,1042,'DHL','variant-tracking','in_transit','2026-06-18T12:00:00Z',NULL,NULL);`);
    }
    finally {database.close();}
});
afterAll(() => {if (directory) rmSync(directory, {recursive: true, force: true});});

const grade = async (sql: string, expected: unknown): Promise<EvaluationTrace & {passed: boolean}> =>
{
    const result = await queryDataset(sql, {databasePath});
    const fixture: EvaluationScenario = {id: 'variant', category: 'analytics', prompt: 'Adversarial variant reference',
        expectedTools: ['query_dataset'], expectedBlocks: ['markdown'], mustNotInvoke: [], dataAssertions: ['exact result'],
        deterministicAssertions: [{source: 'denotation', label: 'exact result', tool: 'query_dataset', path: 'denotationTuples',
            operator: 'exact', expected: expected as number[][], arrayOrder: 'ordered'}]};
    const trace: EvaluationTrace = {scenarioId: fixture.id, runId: 'variant:1:test', startedAt: '', completedAt: '', events: [],
        text: 'A variant fixture result.', blocks: [], toolCalls: ['query_dataset'], responseIds: [], latency: {totalMs: 1},
        toolExecutions: [{round: 1, callId: 'variant', name: 'query_dataset', arguments: {sql}, modelOutput: result,
            durationMs: 1, cached: false, rejected: false, candidateBlockIds: [], candidateBlockTypes: []}]};
    return {...trace, passed: (await evaluateTrace(fixture, trace)).status === 'passed'};
};

describe('declared adversarial variants of the existing retail fixture', () =>
{
    test('never misidentifies modified payment/shipment data as the versioned baseline', () =>
    {
        expect(inspectEvaluationDataset(databasePath).isBaseline).toBeFalse();
    });
    test('distinguishes null payment times from row counts', async () =>
    {
        expect((await grade('SELECT COUNT(paid_at) AS n FROM payments WHERE order_id = 1176', [[0]])).passed).toBeTrue();
        expect((await grade('SELECT COUNT(*) AS n FROM payments WHERE order_id = 1176', [[0]])).passed).toBeFalse();
    });
    test('grades partial captures and refunded money without conflating them with revenue', async () =>
    {
        const correct = "SELECT SUM(CASE WHEN status = 'refunded' THEN -amount_cents ELSE amount_cents END) / 100.0 AS net_eur FROM payments WHERE order_id = 1042";
        expect((await grade(correct, [[95]])).passed).toBeTrue();
        expect((await grade('SELECT SUM(amount_cents)/100.0 AS net_eur FROM payments WHERE order_id=1042', [[95]])).passed).toBeFalse();
    });
    test('detects multiplication through multiple payments and shipment legs despite approved JOINs', async () =>
    {
        const join = 'FROM orders o JOIN payments p ON p.order_id=o.id JOIN shipments s ON s.order_id=o.id WHERE o.id=1042';
        expect((await grade(`SELECT COUNT(DISTINCT o.id) AS n ${join}`, [[1]])).passed).toBeTrue();
        expect((await grade(`SELECT COUNT(o.id) AS n ${join}`, [[1]])).passed).toBeFalse();
    });
    test('keeps sparse sets and missing aggregates distinct from invented zero values', async () =>
    {
        expect((await grade('SELECT id FROM customers WHERE id < 0', [])).passed).toBeTrue();
        const result = await queryDataset('SELECT MAX(joined_at) AS joined_at FROM customers WHERE id < 0', {databasePath});
        expect(result.rows).toEqual([{c0: null}]);
    });
    test('rejects anomalous nonrepresentable numeric results rather than grading rounded inventions', async () =>
    {
        await expect(queryDataset('SELECT SUM(total_cents)*1e20 AS amount FROM orders', {databasePath})).rejects.toThrow('SQL_RESULT_LIMIT');
    });
    test('data-backed repositories can inspect the variant without touching retained storage', () =>
    {
        const repository = createDemoRepository({databasePath});
        try {expect(repository.getOrder(1042)?.orderNumber).toBe('ORD-1042');}
        finally {repository.close();}
    });
});
