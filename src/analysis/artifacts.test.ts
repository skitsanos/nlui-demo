import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ConversationStore} from '../conversations/store.ts';
import {resetDemoDatabase} from '../data/index.ts';
import {applyPlanDelta, artifactFor, executeAnalysis, inputPlan, receiptMatchesPlan} from './artifacts.ts';

let root: string; let store: ConversationStore; let databasePath: string;
beforeAll(() => {root = mkdtempSync(join(tmpdir(), 'nlui-artifacts-')); databasePath = join(root, 'demo.sqlite'); resetDemoDatabase({databasePath}); store = new ConversationStore(join(root, 'state.sqlite'));});
afterAll(() => {store.close(); rmSync(root, {recursive: true, force: true});});

describe('immutable analytical plans and exact refinement receipts', () =>
{
    test('deltas retain unstated context, create new identities and bind exact result/query/plan hashes', async () =>
    {
        const first = await executeAnalysis({store, databasePath, conversation: 'analysis-a', plan: {
            metric: 'eligible_revenue_eur', dimensions: ['region'], filters: [{dimension: 'customer_tier', values: ['gold']}],
            timeRange: {from: '2026-01-01', to: '2026-06-30'}}});
        const changed = applyPlanDelta(first.artifact.plan, {dimensions: ['month'], limit: 3, orderBy: {field: 'metric', direction: 'desc'}});
        expect(changed.filters).toEqual(first.artifact.plan.filters); expect(changed.timeRange).toEqual(first.artifact.plan.timeRange);
        const refined = await executeAnalysis({store, databasePath, conversation: 'analysis-a', plan: inputPlan(changed), parentResultId: first.artifact.receipt.resultId});
        expect(refined.artifact.receipt.parentResultId).toBe(first.artifact.receipt.resultId);
        expect(refined.artifact.receipt.resultId).not.toBe(first.artifact.receipt.resultId);
        expect(refined.artifact.receipt.planId).not.toBe(first.artifact.receipt.planId);
        expect(refined.artifact.receipt.planHash).not.toBe(first.artifact.receipt.planHash);
        expect(refined.artifact.receipt.rowCount).toBe(3);
        expect(refined.artifact.receipt.unit).toBe('EUR'); expect(refined.artifact.receipt.grain).toBe('order');
        expect(artifactFor(store, 'analysis-a', first.artifact.receipt.resultId).plan).toEqual(first.artifact.plan);
        expect(() => artifactFor(store, 'analysis-b', first.artifact.receipt.resultId)).toThrow('not found');
        expect(refined.blocks[0]!.analysis).toEqual(refined.artifact.receipt);
        expect(JSON.stringify(refined.blocks)).not.toContain('SELECT');
        expect(refined.artifact.receipt.queryHash).toMatch(/^[a-f0-9]{64}$/);
        expect(refined.artifact.receipt.resultHash).toMatch(/^[a-f0-9]{64}$/);
        expect(receiptMatchesPlan(refined.artifact.plan, refined.artifact.receipt)).toBeTrue();
        for (const mismatch of [{filters: []}, {dimensions: ['region']}, {unit: 'count'}, {timeRange: null}])
            expect(receiptMatchesPlan(refined.artifact.plan, {...refined.artifact.receipt, ...mismatch})).toBeFalse();
    });

    test('incompatible metrics, unknown result referents and stale/mismatched filters fail without inference', async () =>
    {
        const first = await executeAnalysis({store, databasePath, conversation: 'analysis-filters', plan: {metric: 'eligible_revenue_eur', dimensions: ['region']}});
        expect(() => applyPlanDelta(first.artifact.plan, {sql: 'DROP TABLE customers'})).toThrow();
        expect(() => applyPlanDelta({...first.artifact.plan, catalogVersion: 2} as unknown as typeof first.artifact.plan, {dimensions: ['region']})).toThrow('catalog changed');
        expect(() => applyPlanDelta(first.artifact.plan, {metric: 'registered_customer_count', timeRange: {from: '2026-01-01', to: '2026-02-01'}})).toThrow();
        expect(() => applyPlanDelta(first.artifact.plan, {filters: [{dimension: 'region', values: ['Not-a-region']}]})).toThrow();
        expect(() => artifactFor(store, 'analysis-filters', 'latest')).toThrow();
        const changed = applyPlanDelta(first.artifact.plan, {filters: [{dimension: 'region', values: ['West']}]});
        expect(changed.filters).not.toEqual(first.artifact.receipt.filters);
        expect(first.artifact.receipt.filters).toEqual([]);
    });
});
