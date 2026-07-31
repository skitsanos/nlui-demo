import {describe, expect, test} from 'bun:test';
import {evaluationExitCode, runEvaluationSuite, selectScenarios} from './run.ts';
import type {EvaluationScenario} from './scenario.ts';
import type {EvaluationTrace, ScenarioExecutor} from './types.ts';

const scenarios: EvaluationScenario[] = [
    {
        id: 'analytics-one',
        category: 'analytics',
        prompt: 'One',
        expectedTools: ['query_dataset'],
        expectedBlocks: ['markdown'],
        mustNotInvoke: ['prepare_action'],
        dataAssertions: ['one is correct']
    },
    {
        id: 'orders-two',
        category: 'orders',
        prompt: 'Two',
        expectedTools: ['list_orders'],
        expectedBlocks: ['table'],
        mustNotInvoke: ['confirm_action'],
        dataAssertions: ['two is correct']
    }
];

const executor: ScenarioExecutor = async ({scenario, runId}) =>
{
    const text = scenario.category === 'analytics' ? 'One' : '';
    const blocks: EvaluationTrace['blocks'] = scenario.category === 'orders' ? [{
        id: 'orders',
        type: 'table',
        columns: [{key: 'id', label: 'ID'}],
        rows: [{id: 'ORD-1'}],
        rowKey: 'id'
    }] : [];
    return {
        scenarioId: scenario.id,
        runId,
        startedAt: '2026-07-30T10:00:00.000Z',
        completedAt: '2026-07-30T10:00:00.025Z',
        events: [],
        text,
        toolCalls: [...scenario.expectedTools],
        blocks,
        responseIds: [],
        latency: {totalMs: 25},
        usage: {inputTokens: 10, outputTokens: 5, totalTokens: 15}
    };
};

describe('evaluation runner', () =>
{
    test('fails closed for failed, errored, and incomplete reports', () =>
    {
        expect(evaluationExitCode({failed: 1, errors: 0, incomplete: 0})).toBe(1);
        expect(evaluationExitCode({failed: 0, errors: 1, incomplete: 0})).toBe(1);
        expect(evaluationExitCode({failed: 0, errors: 0, incomplete: 1})).toBe(2);
        expect(evaluationExitCode({failed: 0, errors: 0, incomplete: 1}, true)).toBe(0);
        expect(evaluationExitCode({failed: 0, errors: 0, incomplete: 0})).toBe(0);
        expect(evaluationExitCode({failed: 0, errors: 0, incomplete: 0}, false, true)).toBe(1);
    });

    test('requires explicit, bounded live selection', () =>
    {
        expect(() => selectScenarios(scenarios, {})).toThrow('explicit scenario id or category');
        expect(() => selectScenarios(scenarios, {ids: ['missing']})).toThrow('Unknown scenario');
        expect(selectScenarios(scenarios, {categories: ['analytics']})).toEqual([scenarios[0]]);
        expect(selectScenarios(scenarios, {ids: ['orders-two']})).toEqual([scenarios[1]]);
        expect(() => selectScenarios(scenarios, {ids: ['analytics-one'], limit: 11})).toThrow('between 1 and 10');
    });

    test('runs bounded repeats and aggregates latency and optional usage', async () =>
    {
        const report = await runEvaluationSuite({
            scenarios,
            executor,
            repeat: 2,
            dataAssertionEvaluator: (fixture) => fixture.dataAssertions.map((assertion) => ({
                assertion,
                status: 'passed'
            }))
        });
        expect(report.results).toHaveLength(4);
        expect(report.summary.passed).toBe(4);
        expect(report.summary.totalLatencyMs).toBe(100);
        expect(report.summary.usage?.totalTokens).toBe(60);
        expect(new Set(report.results.map(({runId}) => runId)).size).toBe(4);
    });

    test('records executor errors instead of aborting the suite', async () =>
    {
        const report = await runEvaluationSuite({
            scenarios: [scenarios[0]!],
            executor: async () => { throw new Error('provider unavailable'); }
        });
        expect(report.summary.errors).toBe(1);
        expect(report.results[0]?.error).toBe('provider unavailable');
    });
});
