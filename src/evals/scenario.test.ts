import {describe, expect, test} from 'bun:test';
import {join} from 'node:path';
import {
    type EvaluationScenario,
    evaluationScenarioSchema,
    loadEvaluationScenarios,
    parseScenarioJsonl
} from './scenario.ts';

const validScenario = (): EvaluationScenario => ({
    id: 'analytics-example',
    category: 'analytics',
    prompt: 'How many customers are there?',
    expectedTools: ['query_dataset'],
    expectedBlocks: ['metrics', 'markdown'],
    mustNotInvoke: ['prepare_action', 'confirm_action'],
    dataAssertions: ['customer count is exact']
});

describe('evaluation scenario catalog', () =>
{
    test('loads the existing JSONL catalog through the reusable schema', async () =>
    {
        const scenarios = await loadEvaluationScenarios(join(process.cwd(), 'data', 'scenarios.jsonl'));
        expect(scenarios).toHaveLength(35);
        expect(new Set(scenarios.map(({id}) => id)).size).toBe(scenarios.length);
        expect(scenarios.every((scenario) => evaluationScenarioSchema.safeParse(scenario).success)).toBeTrue();
    });

    test('rejects unknown properties and expectation conflicts', () =>
    {
        expect(() => evaluationScenarioSchema.parse({...validScenario(), unexpected: true})).toThrow();
        expect(() => evaluationScenarioSchema.parse({
            ...validScenario(),
            mustNotInvoke: ['query_dataset']
        })).toThrow('Expected tools cannot also be forbidden');
        expect(() => evaluationScenarioSchema.parse({
            ...validScenario(),
            deterministicAssertions: [{
                source: 'ui',
                label: 'customer count is exact',
                operator: 'block_types_equal',
                expected: ['markdown']
            }]
        })).toThrow('UI block-type assertions must match expectedBlocks');
    });

    test('accepts denotation, SQL-semantic, and repair assertions', () =>
    {
        const parsed = evaluationScenarioSchema.parse({
            ...validScenario(),
            dataAssertions: ['rows match', 'tuples match', 'query intent is preserved', 'one repair succeeds'],
            deterministicAssertions: [
                {
                    source: 'denotation',
                    label: 'rows match',
                    tool: 'query_dataset',
                    path: 'rows',
                    operator: 'within_tolerance',
                    expected: [{tier: 'gold', revenue_eur: 100.25}],
                    arrayOrder: 'unordered',
                    tolerance: {absolute: 0.01, relative: 0.001}
                },
                {
                    source: 'denotation',
                    label: 'tuples match',
                    tool: 'query_dataset',
                    path: 'denotationTuples',
                    operator: 'exact',
                    expected: [['gold', 100.25]],
                    arrayOrder: 'ordered'
                },
                {
                    source: 'sql_semantics',
                    label: 'query intent is preserved',
                    tool: 'query_dataset',
                    operator: 'has_join',
                    expected: {left: 'customers.id', right: 'orders.customer_id'}
                },
                {
                    source: 'tool_sequence',
                    label: 'one repair succeeds',
                    tool: 'query_dataset',
                    operator: 'successful_attempt_equals',
                    expected: 2
                }
            ]
        });

        expect(parsed.deterministicAssertions).toHaveLength(4);
    });

    test('accepts strict query-experiment identity metadata', () =>
    {
        const parsed = evaluationScenarioSchema.parse({
            ...validScenario(),
            experiment: {id: 'query-arm-v1', caseId: 'customer-count', paraphraseId: 'direct'}
        });
        expect(parsed.experiment).toEqual({
            id: 'query-arm-v1',
            caseId: 'customer-count',
            paraphraseId: 'direct'
        });
        expect(() => evaluationScenarioSchema.parse({
            ...validScenario(),
            experiment: {id: 'query-arm-v1', caseId: 'customer-count', paraphraseId: 'direct', arm: 'control'}
        })).toThrow();
    });

    test('rejects incomplete denotation and malformed semantic assertions', () =>
    {
        expect(() => evaluationScenarioSchema.parse({
            ...validScenario(),
            deterministicAssertions: [{
                source: 'denotation',
                label: 'customer count is exact',
                tool: 'query_dataset',
                path: 'rows',
                operator: 'within_tolerance',
                expected: [{customer_count: 200}]
            }]
        })).toThrow('within_tolerance requires tolerance');
        expect(() => evaluationScenarioSchema.parse({
            ...validScenario(),
            deterministicAssertions: [{
                source: 'sql_semantics',
                label: 'customer count is exact',
                tool: 'query_dataset',
                operator: 'uses_time_field',
                expected: {column: 'orders.created-at', clause: 'filter'}
            }]
        })).toThrow();
    });

    test('reports JSONL line errors and duplicate identifiers', () =>
    {
        const valid = JSON.stringify(validScenario());
        expect(() => parseScenarioJsonl(`${valid}\n\n${valid}`)).toThrow('Invalid empty scenario on line 2');
        expect(() => parseScenarioJsonl(`${valid}\nnot-json`)).toThrow('Invalid scenario on line 2');
        expect(() => parseScenarioJsonl(`${valid}\n${valid}`)).toThrow('Scenario identifiers must be unique');
    });

    test('rejects missing and cyclic multi-turn prerequisites', () =>
    {
        const first = {...validScenario(), id: 'first'};
        expect(() => parseScenarioJsonl(JSON.stringify({
            ...first,
            execution: {mode: 'multi-turn', priorScenarioIds: ['missing']}
        }))).toThrow('unknown prior scenario');

        const cycleA = {...first, execution: {mode: 'multi-turn', priorScenarioIds: ['second']}};
        const cycleB = {...first, id: 'second', execution: {mode: 'multi-turn', priorScenarioIds: ['first']}};
        expect(() => parseScenarioJsonl(`${JSON.stringify(cycleA)}\n${JSON.stringify(cycleB)}`))
            .toThrow('contain a cycle');
    });
});
