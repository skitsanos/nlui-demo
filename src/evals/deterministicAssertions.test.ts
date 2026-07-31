import {describe, expect, test} from 'bun:test';
import type {ChatToolTrace} from '../services/chatTrace.ts';
import {evaluateTrace} from './evaluate.ts';
import type {DeterministicAssertion, EvaluationScenario} from './scenario.ts';
import type {EvaluationTrace} from './types.ts';

const sql = `SELECT c.tier AS tier, SUM(o.total_cents) / 100.0 AS revenue_eur
             FROM customers c
             JOIN orders o ON c.id = o.customer_id
             WHERE o.created_at >= '2026-01-01'
               AND o.status NOT IN ('cancelled', 'returned')
             GROUP BY c.tier`;

const toolExecution = (overrides: Partial<ChatToolTrace> = {}): ChatToolTrace => ({
    round: 2,
    callId: 'call-success',
    name: 'query_dataset',
    arguments: {sql},
    modelOutput: {
        columns: [
            {key: 'c0', name: 'tier', label: 'Tier', kind: 'text'},
            {key: 'c1', name: 'revenue_eur', label: 'Revenue', kind: 'number'},
            {key: 'c2', name: '_sort', label: 'Sort', kind: 'number'}
        ],
        rows: [
            {c0: 'silver', c1: 200, c2: 2},
            {c0: 'gold', c1: 100.004, c2: 1}
        ],
        presentationColumnKeys: ['c0', 'c1'],
        returnedRowCount: 2
    },
    candidateBlockIds: ['result-chart'],
    candidateBlockTypes: ['chart'],
    durationMs: 4,
    cached: false,
    rejected: false,
    ...overrides
});

const trace = (overrides: Partial<EvaluationTrace> = {}): EvaluationTrace => ({
    scenarioId: 'denotation-stage-a',
    runId: 'run-1',
    startedAt: '2026-07-31T10:00:00.000Z',
    completedAt: '2026-07-31T10:00:00.100Z',
    events: [],
    text: 'Revenue is grouped by customer tier for the selected period.',
    toolCalls: ['query_dataset'],
    toolExecutions: [toolExecution()],
    blocks: [],
    responseIds: ['response-1'],
    latency: {totalMs: 100},
    ...overrides
});

const scenario = (assertions: DeterministicAssertion[]): EvaluationScenario => ({
    id: 'denotation-stage-a',
    category: 'analytics',
    prompt: 'Compare eligible revenue by customer tier in 2026.',
    expectedTools: ['query_dataset'],
    expectedBlocks: ['markdown'],
    mustNotInvoke: [],
    dataAssertions: [...new Set(assertions.map(({label}) => label))],
    deterministicAssertions: assertions
});

describe('Stage A deterministic evidence', () =>
{
    test('normalizes named rows and grades scalar, row, and unordered series denotations', async () =>
    {
        const fixture = scenario([
            {
                source: 'denotation',
                label: 'scalar count',
                tool: 'query_dataset',
                path: 'returnedRowCount',
                operator: 'exact',
                expected: 2
            },
            {
                source: 'denotation',
                label: 'first row',
                tool: 'query_dataset',
                path: 'rows.0',
                operator: 'exact',
                expected: {tier: 'silver', revenue_eur: 200}
            },
            {
                source: 'denotation',
                label: 'complete series',
                tool: 'query_dataset',
                path: 'rows',
                operator: 'within_tolerance',
                expected: [
                    {tier: 'gold', revenue_eur: 100},
                    {tier: 'silver', revenue_eur: 200}
                ],
                arrayOrder: 'unordered',
                tolerance: {absolute: 0.01}
            }
        ]);

        const result = await evaluateTrace(fixture, trace());
        expect(result.status).toBe('passed');
        expect(result.dataAssertions.every(({status}) => status === 'passed')).toBeTrue();

        const ordered = scenario([{
            source: 'denotation',
            label: 'ordered series',
            tool: 'query_dataset',
            path: 'rows',
            operator: 'within_tolerance',
            expected: [
                {tier: 'gold', revenue_eur: 100},
                {tier: 'silver', revenue_eur: 200}
            ],
            arrayOrder: 'ordered',
            tolerance: {absolute: 0.01}
        }]);
        const failed = await evaluateTrace(ordered, trace());
        expect(failed.status).toBe('failed');
        expect(failed.dataAssertions[0]?.detail).toContain('Denotation at rows');
    });

    test('grades exact alias-neutral denotation tuples in selected column order', async () =>
    {
        const fixture = scenario([{
            source: 'denotation',
            label: 'exact tuples',
            tool: 'query_dataset',
            path: 'denotationTuples',
            operator: 'exact',
            expected: [['silver', 200], ['gold', 100.004]],
            arrayOrder: 'ordered'
        }]);
        const aliased = trace({toolExecutions: [toolExecution({modelOutput: {
            columns: [
                {key: 'c0', name: 'customer_segment', label: 'Segment', kind: 'text'},
                {key: 'c1', name: 'eligible_sales', label: 'Sales', kind: 'number'},
                {key: 'c2', name: 'internal_sort', label: 'Sort', kind: 'number'}
            ],
            rows: [
                {c0: 'silver', c1: 200, c2: 2},
                {c0: 'gold', c1: 100.004, c2: 1}
            ],
            presentationColumnKeys: ['c0', 'c1']
        }})]});

        expect((await evaluateTrace(fixture, aliased)).status).toBe('passed');
    });

    test('grades denotation tuple rows without depending on row order', async () =>
    {
        const fixture = scenario([{
            source: 'denotation',
            label: 'unordered tuples',
            tool: 'query_dataset',
            path: 'denotationTuples',
            operator: 'exact',
            expected: [['gold', 100.004], ['silver', 200]],
            arrayOrder: 'unordered'
        }]);

        expect((await evaluateTrace(fixture, trace())).status).toBe('passed');
    });

    test('applies numeric tolerance inside alias-neutral denotation tuples', async () =>
    {
        const fixture = scenario([{
            source: 'denotation',
            label: 'tolerant tuples',
            tool: 'query_dataset',
            path: 'denotationTuples',
            operator: 'within_tolerance',
            expected: [['gold', 100], ['silver', 200]],
            arrayOrder: 'unordered',
            tolerance: {absolute: 0.01}
        }]);

        expect((await evaluateTrace(fixture, trace())).status).toBe('passed');
    });

    test('grades joins, time fields, grain, units, and default exclusions from validated SQL', async () =>
    {
        const fixture = scenario([
            {
                source: 'sql_semantics', label: 'approved join', tool: 'query_dataset', operator: 'has_join',
                expected: {left: 'customers.id', right: 'orders.customer_id'}
            },
            {
                source: 'sql_semantics', label: 'sales time field', tool: 'query_dataset', operator: 'uses_time_field',
                expected: {column: 'orders.created_at', clause: 'filter'}
            },
            {
                source: 'sql_semantics', label: 'tier grain', tool: 'query_dataset', operator: 'groups_by',
                expected: ['customers.tier']
            },
            {
                source: 'sql_semantics', label: 'EUR units', tool: 'query_dataset', operator: 'projects_unit',
                expected: {sourceColumn: 'orders.total_cents', divisor: 100}
            },
            {
                source: 'sql_semantics', label: 'eligible statuses', tool: 'query_dataset', operator: 'excludes_values',
                expected: {column: 'orders.status', values: ['cancelled', 'returned']}
            }
        ]);

        expect((await evaluateTrace(fixture, trace())).status).toBe('passed');

        const temporalGrain = scenario([{
            source: 'sql_semantics', label: 'monthly sales field', tool: 'query_dataset', operator: 'uses_time_field',
            expected: {column: 'orders.created_at', clause: 'group'}
        }]);
        const temporalTrace = trace({toolExecutions: [toolExecution({arguments: {sql: `
            SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS order_count
            FROM orders GROUP BY month
        `}})]});
        expect((await evaluateTrace(temporalGrain, temporalTrace)).status).toBe('passed');

        const wrongGrain = scenario([{
            source: 'sql_semantics', label: 'region grain', tool: 'query_dataset', operator: 'groups_by',
            expected: ['orders.region']
        }]);
        const failed = await evaluateTrace(wrongGrain, trace());
        expect(failed.status).toBe('failed');
        expect(failed.dataAssertions[0]?.detail).toContain('groups_by');
    });

    test('derives first-attempt and one-repair success from uncached tool traces', async () =>
    {
        const fixture = scenario([{
            source: 'tool_sequence',
            label: 'one repair succeeds',
            tool: 'query_dataset',
            operator: 'successful_attempt_equals',
            expected: 2
        }]);
        const rejected = toolExecution({
            round: 1,
            callId: 'call-rejected',
            modelOutput: {ok: false, error: 'SQL_POLICY'},
            candidateBlockIds: [],
            candidateBlockTypes: [],
            rejected: true
        });
        const cached = toolExecution({callId: 'call-cached', cached: true});
        const repaired = trace({toolExecutions: [rejected, cached, toolExecution()]});

        expect((await evaluateTrace(fixture, repaired)).status).toBe('passed');

        const firstAttempt = trace({toolExecutions: [toolExecution()]});
        const failed = await evaluateTrace(fixture, firstAttempt);
        expect(failed.status).toBe('failed');
        expect(failed.dataAssertions[0]?.detail).toContain('observed 1');
    });
});
