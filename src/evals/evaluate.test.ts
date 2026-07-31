import {describe, expect, test} from 'bun:test';
import {evaluateTrace, observedBlockNames} from './evaluate.ts';
import type {EvaluationScenario} from './scenario.ts';
import type {EvaluationTrace} from './types.ts';

const scenario: EvaluationScenario = {
    id: 'analytics-example',
    category: 'analytics',
    prompt: 'Count customers',
    expectedTools: ['query_dataset'],
    expectedBlocks: ['metrics', 'markdown'],
    mustNotInvoke: ['prepare_action'],
    dataAssertions: ['customer count is exact']
};

const trace = (overrides: Partial<EvaluationTrace> = {}): EvaluationTrace => ({
    scenarioId: scenario.id,
    runId: 'run-1',
    startedAt: '2026-07-30T10:00:00.000Z',
    completedAt: '2026-07-30T10:00:00.100Z',
    events: [],
    text: 'There are 200 customers.',
    toolCalls: ['query_dataset'],
    blocks: [{
        id: 'customers',
        type: 'stats',
        items: [{label: 'Customers', value: 200}]
    }],
    responseIds: ['response-1'],
    latency: {totalMs: 100, firstTextMs: 80, firstUiMs: 60},
    ...overrides
});

describe('deterministic evaluation', () =>
{
    test('maps runtime blocks to scenario concepts', () =>
    {
        expect(observedBlockNames(trace())).toEqual(['metrics', 'markdown']);
        expect(observedBlockNames(trace({
            text: '',
            blocks: [
                {id: 'choices', type: 'choices', interactionId: 'i-1', options: [{label: 'A', value: 'a'}]},
                {id: 'sources', type: 'sources', items: [{title: 'Policy', excerpt: 'Excerpt', source: 'policy.md'}]},
                {id: 'error', type: 'result', status: 'error', message: 'No result'}
            ]
        }))).toEqual(['choice', 'citations', 'error']);
    });

    test('keeps semantic assertions explicitly incomplete without a grader', async () =>
    {
        const result = await evaluateTrace(scenario, trace());
        expect(result.status).toBe('incomplete');
        expect(result.checks.every(({status}) => status === 'passed')).toBeTrue();
        expect(result.dataAssertions[0]?.status).toBe('not_evaluated');
    });

    test('passes with an assertion hook and fails forbidden tool calls', async () =>
    {
        const passed = await evaluateTrace(scenario, trace(), (fixture) => fixture.dataAssertions.map((assertion) => ({
            assertion,
            status: 'passed'
        })));
        expect(passed.status).toBe('passed');

        const failed = await evaluateTrace(scenario, trace({toolCalls: ['query_dataset', 'prepare_action']}));
        expect(failed.status).toBe('failed');
        expect(failed.checks.find(({name}) => name === 'forbidden_tools')?.status).toBe('failed');
    });

    test('grades configured tool-output assertions without a model grader', async () =>
    {
        const deterministic: EvaluationScenario = {
            ...scenario,
            deterministicAssertions: [
                {
                    source: 'tool',
                    label: 'customer count is exact',
                    tool: 'query_dataset',
                    path: 'rows.0.customer_count',
                    operator: 'equals',
                    expected: 200
                },
                {
                    source: 'tool',
                    label: 'customer count is exact',
                    tool: 'query_dataset',
                    path: 'rows.0',
                    operator: 'contains_value',
                    expected: 200
                },
                {
                    source: 'assistant_text',
                    label: 'customer count is exact',
                    operator: 'number_equals',
                    expected: 200
                },
                {
                    source: 'assistant_text',
                    label: 'customer count is exact',
                    operator: 'not_contains_ci',
                    expected: '2,000'
                },
                {
                    source: 'tool_arguments',
                    label: 'customer count is exact',
                    tool: 'query_dataset',
                    operator: 'sql_where_equals',
                    expected: {column: 'tier', value: 'gold'}
                }
            ]
        };
        const result = await evaluateTrace(deterministic, trace({
            toolExecutions: [{
                round: 1,
                callId: 'call-1',
                name: 'query_dataset',
                arguments: {sql: "SELECT COUNT(*) AS customer_count FROM customers WHERE tier = 'gold'"},
                modelOutput: {rows: [{customer_count: 200}]},
                candidateBlockIds: ['customers'],
                candidateBlockTypes: ['stats'],
                durationMs: 5,
                cached: false,
                rejected: false
            }]
        }));
        expect(result.status).toBe('passed');
        expect(result.dataAssertions[0]?.status).toBe('passed');

        const missingFilter = await evaluateTrace(deterministic, trace({
            toolExecutions: [{
                ...result.trace.toolExecutions![0]!,
                arguments: {sql: 'SELECT COUNT(*) AS customer_count FROM customers'}
            }]
        }));
        expect(missingFilter.status).toBe('failed');

        const unfaithful = await evaluateTrace(deterministic, trace({
            text: 'There are 2,000 customers.',
            toolExecutions: result.trace.toolExecutions
        }));
        expect(unfaithful.status).toBe('failed');
    });

    test('grades the exact user-facing block set for a prose-only scalar', async () =>
    {
        const proseOnly: EvaluationScenario = {
            ...scenario,
            expectedBlocks: ['markdown'],
            dataAssertions: ['simple scalar stays in prose'],
            deterministicAssertions: [{
                source: 'ui',
                label: 'simple scalar stays in prose',
                operator: 'block_types_equal',
                expected: ['markdown']
            }]
        };
        const passed = await evaluateTrace(proseOnly, trace({blocks: [], text: 'Registered on 14 Dec 2025.'}));
        expect(passed.status).toBe('passed');

        const redundant = await evaluateTrace(proseOnly, trace({
            text: 'Registered on 14 Dec 2025.',
            blocks: [{
                id: 'registered-at',
                type: 'stats',
                items: [{label: 'Registered at', value: '2025-12-14T12:00:00.000Z', format: 'date'}]
            }]
        }));
        expect(redundant.status).toBe('failed');
        expect(redundant.dataAssertions[0]?.detail).toContain('observed ["markdown","metrics"]');
    });

    test('rejects a trace for another scenario', async () =>
    {
        expect(evaluateTrace(scenario, trace({scenarioId: 'other'}))).rejects.toThrow('does not match');
    });
});
