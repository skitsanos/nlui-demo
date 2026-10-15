import {describe, expect, test} from 'bun:test';
import {collectionCheck, valueAtPath} from './assertionValues.ts';
import {evaluateTrace} from './evaluate.ts';
import {createReferenceExecutor} from './referenceExecutor.ts';
import {runEvaluationSuite} from './run.ts';
import {type DeterministicAssertion, type EvaluationScenario, loadEvaluationScenarios} from './scenario.ts';
import type {EvaluationTrace} from './types.ts';

const trace = (text = '200 customers'): EvaluationTrace => ({scenarioId: 'check', runId: 'check:1:test',
    startedAt: '2026-10-15T00:00:00Z', completedAt: '2026-10-15T00:00:01Z', text, events: [], toolCalls: ['query_dataset'],
    toolExecutions: [{round: 1, callId: 'q', name: 'query_dataset', arguments: {sql: 'SELECT COUNT(*) AS n FROM customers'},
        modelOutput: {rows: [{n: 200}]}, candidateBlockIds: [], candidateBlockTypes: [], durationMs: 1, cached: false, rejected: false}],
    blocks: [], responseIds: [], latency: {totalMs: 1}});
const scenario = (rules: DeterministicAssertion[]): EvaluationScenario => ({id: 'check', category: 'analytics', prompt: 'Count',
    expectedTools: ['query_dataset'], expectedBlocks: ['markdown'], mustNotInvoke: ['prepare_action'],
    dataAssertions: [...new Set(rules.map(({label}) => label))], deterministicAssertions: rules});

describe('complete assertion classification and fail-closed evidence', () =>
{
    test('runs all 35 reference cases against isolated real tools, including routes and trajectory', async () =>
    {
        const catalog = await loadEvaluationScenarios();
        const executor = createReferenceExecutor(catalog);
        const results = [];
        for (let index = 0; index < catalog.length; index += 10)
        {
            const report = await runEvaluationSuite({scenarios: catalog.slice(index, index + 10), executor});
            expect(report.versions?.evaluator).toBe('deterministic-v2');
            results.push(...report.results);
        }
        expect(results).toHaveLength(35);
        expect(results.filter(({status}) => status === 'passed')).toHaveLength(28);
        expect(results.filter(({status}) => status === 'incomplete')).toHaveLength(7);
        expect(results.filter(({status}) => status === 'failed' || status === 'error')).toEqual([]);
        expect(results.flatMap(({dataAssertions}) => dataAssertions).filter(({status}) => status === 'not_evaluated'))
            .toHaveLength(7);
        expect(results.every(({trace}) => trace.fixture && !trace.fixture.unexpectedMutation)).toBeTrue();
        const trajectory = results.find(({scenarioId}) => scenarioId === 'analytics-customers-by-tier')!.trace;
        expect(trajectory.trajectory?.map(({scenarioId}) => scenarioId)).toEqual(['analytics-customer-count']);
        expect(results.find(({scenarioId}) => scenarioId === 'action-return-confirm')!.trace.fixture?.after.requestedReturns)
            .toBe(1);
    }, 30_000);

    test('repeats route mutations from independent baselines and retries each only once', async () =>
    {
        const catalog = await loadEvaluationScenarios();
        const selected = catalog.filter(({id}) => id === 'action-return-confirm');
        const report = await runEvaluationSuite({scenarios: selected, executor: createReferenceExecutor(catalog), repeat: 3});
        expect(report.summary.passed).toBe(3);
        expect(report.results.map(({trace}) => trace.fixture?.before.requestedReturns)).toEqual([0, 0, 0]);
        expect(report.results.map(({trace}) => trace.fixture?.after.requestedReturns)).toEqual([1, 1, 1]);
        expect(report.results.every(({accounting}) => accounting?.toolAttempts === 1 && accounting.cacheReplays === 1)).toBeTrue();
        expect(report.stability?.[0]).toMatchObject({runs: 3, stable: true, allPassed: true});
    }, 15_000);

    test('unsupported labels remain incomplete even if another rule on the same label passes', async () =>
    {
        const fixture = scenario([{source: 'tool', label: 'meaning', tool: 'query_dataset', path: 'rows.0.n', operator: 'equals', expected: 200},
            {source: 'unsupported', label: 'meaning', reason: 'No calibrated language grader is installed.'}]);
        const result = await evaluateTrace(fixture, trace());
        expect(result.status).toBe('incomplete');
        expect(result.dataAssertions[0]?.detail).toContain('calibrated');
    });

    test.each(['200 customers', '200 customers and 20 customers', '20 customers', 'No numerical answer'])
    ('checks every matched numerical claim against tool evidence: %s', async (text) =>
    {
        const result = await evaluateTrace(scenario([{source: 'numeric_claim', label: 'number', tool: 'query_dataset',
            path: 'rows.0.n', pattern: '([0-9,]+) customers', scale: 1, tolerance: 0}]), trace(text));
        expect(result.status).toBe(text === '200 customers' ? 'passed' : 'failed');
    });

    test('counts forbidden tool invocations from receipts, even if omitted from the claimed tool list', async () =>
    {
        const observed = trace();
        observed.toolExecutions!.push({...observed.toolExecutions![0]!, name: 'prepare_action', rejected: true});
        expect((await evaluateTrace(scenario([]), observed)).checks.find(({name}) => name === 'forbidden_tools')?.status).toBe('failed');
    });

    test('rejects missing safety receipts and hidden output/SQL columns', async () =>
    {
        const fixture = scenario([{source: 'safety', label: 'safe', operator: 'forbidden_columns', expected: ['email']}]);
        for (const kind of ['missing', 'output', 'sql'])
        {
            const observed = trace();
            if (kind === 'missing') observed.toolExecutions = [];
            else if (kind === 'output') observed.toolExecutions![0]!.modelOutput = {columns: [{name: 'email'}]};
            else observed.toolExecutions![0]!.arguments = {sql: 'SELECT email FROM customers'};
            expect((await evaluateTrace(fixture, observed)).status).toBe('failed');
        }
    });

    test('collection predicates do not prove facts from empty/missing/null or wrong-type data', () =>
    {
        expect(valueAtPath({rows: [{n: 1}, {}]}, 'rows.*.n')).toEqual([1, undefined]);
        for (const value of [[], undefined, null, [null], ['200']])
        {
            expect(collectionCheck('every_gte', value, 1)).toBeFalse();
        }
        expect(collectionCheck('every_present', [1, undefined], true)).toBeFalse();
        expect(collectionCheck('descending', [2, 3], true)).toBeFalse();
        expect(collectionCheck('descending', [3, 2], true)).toBeTrue();
        expect(collectionCheck('some_matches', ['safe'], '[')).toBeFalse();
    });
});
