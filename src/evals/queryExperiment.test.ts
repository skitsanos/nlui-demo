import {describe, expect, test} from 'bun:test';
import {join} from 'node:path';
import type {ChatRoundTrace, ChatToolTrace} from '../services/chatTrace.ts';
import {
    adaptScenarioForArm,
    compareQueryExperiment,
    MAX_PROJECTED_BILLABLE_RUNS,
    projectBillableRuns,
    type QueryExperimentArm
} from './queryExperiment.ts';
import {type EvaluationScenario, loadEvaluationScenarios} from './scenario.ts';
import type {EvaluationReport, EvaluationResult} from './types.ts';

const scenario = (
    id: string,
    caseId: string,
    paraphraseId: string
): EvaluationScenario => ({
    id,
    category: 'analytics',
    prompt: `Prompt for ${paraphraseId}`,
    experiment: {id: 'semantic-ab-v1', caseId, paraphraseId},
    expectedTools: ['query_dataset'],
    expectedBlocks: ['metrics', 'markdown'],
    mustNotInvoke: ['semantic_query', 'prepare_action'],
    dataAssertions: ['count is exact', 'first attempt succeeds'],
    deterministicAssertions: [
        {
            source: 'tool', label: 'count is exact', tool: 'query_dataset',
            path: 'rows.0.count', operator: 'equals', expected: 200
        },
        {
            source: 'denotation', label: 'count is exact', tool: 'query_dataset',
            path: 'rows.0', operator: 'exact', expected: {count: 200}
        },
        {
            source: 'tool_sequence', label: 'first attempt succeeds', tool: 'query_dataset',
            operator: 'successful_attempt_equals', expected: 1
        }
    ]
});

const fixtures = [
    scenario('customer-count-direct', 'customer-count', 'direct'),
    scenario('customer-count-conversational', 'customer-count', 'conversational')
];

const usage = {inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0};

interface ResultOptions
{
    passed?: boolean;
    exactTool?: boolean;
    deterministic?: boolean;
    exactUi?: boolean;
    latencyMs?: number;
    tokens?: number;
    rounds?: number;
    rejectedAttempts?: number;
}

const resultFor = (
    fixture: EvaluationScenario,
    arm: QueryExperimentArm,
    iteration: number,
    options: ResultOptions = {}
): EvaluationResult =>
{
    const adapted = adaptScenarioForArm(fixture, arm);
    const tool = arm === 'control' ? 'query_dataset' : 'semantic_query';
    const rounds = options.rounds ?? 2;
    const rejectedAttempts = options.rejectedAttempts ?? 0;
    const providerRounds: ChatRoundTrace[] = Array.from({length: rounds}, (_, index) => ({
        round: index + 1,
        responseId: `${arm}-response-${index + 1}`,
        model: 'test-model',
        durationMs: 10,
        usage
    }));
    const toolExecutions: ChatToolTrace[] = [
        ...Array.from({length: rejectedAttempts}, (_, index) => ({
            round: index + 1,
            callId: `${arm}-rejected-${index}`,
            name: tool,
            arguments: {},
            modelOutput: {ok: false},
            candidateBlockIds: [],
            candidateBlockTypes: [],
            durationMs: 2,
            cached: false,
            rejected: true
        })),
        {
            round: rejectedAttempts + 1,
            callId: `${arm}-success`,
            name: tool,
            arguments: {},
            modelOutput: {rows: [{count: 200}]},
            candidateBlockIds: ['count'],
            candidateBlockTypes: ['stats'],
            durationMs: 2,
            cached: false,
            rejected: false
        }
    ];
    const deterministic = options.deterministic ?? true;
    const totalTokens = options.tokens ?? 20;
    return {
        scenarioId: fixture.id,
        category: fixture.category,
        runId: `${fixture.id}:${iteration}:${arm}-run`,
        status: options.passed === false ? 'failed' : 'passed',
        expectations: {
            expectedTools: [...adapted.expectedTools],
            expectedBlocks: [...adapted.expectedBlocks],
            forbiddenTools: [...adapted.mustNotInvoke],
            dataAssertions: [...adapted.dataAssertions]
        },
        observed: {
            tools: options.exactTool === false ? [arm === 'control' ? 'semantic_query' : 'query_dataset'] : [...adapted.expectedTools],
            blocks: options.exactUi === false ? ['metrics'] : [...adapted.expectedBlocks]
        },
        checks: [],
        dataAssertions: adapted.dataAssertions.map((assertion) => ({
            assertion,
            status: deterministic ? 'passed' : 'failed'
        })),
        latency: {totalMs: options.latencyMs ?? 100},
        usage: {totalTokens},
        trace: {
            scenarioId: fixture.id,
            runId: `${fixture.id}:${iteration}:${arm}-run`,
            startedAt: '2026-07-31T10:00:00.000Z',
            completedAt: '2026-07-31T10:00:00.100Z',
            events: [],
            text: 'Result annotation.',
            toolCalls: [tool],
            toolExecutions,
            providerRounds,
            blocks: [],
            responseIds: providerRounds.map(({responseId}) => responseId),
            latency: {totalMs: options.latencyMs ?? 100},
            usage: {totalTokens}
        }
    };
};

const reportFor = (
    arm: QueryExperimentArm,
    repeat: number,
    optionsFor: (fixture: EvaluationScenario, iteration: number) => ResultOptions = () => ({})
): EvaluationReport =>
{
    const results = fixtures.flatMap((fixture) => Array.from({length: repeat}, (_, index) =>
        resultFor(fixture, arm, index + 1, optionsFor(fixture, index + 1))
    ));
    const passed = results.filter(({status}) => status === 'passed').length;
    const totalLatencyMs = results.reduce((sum, {latency}) => sum + latency.totalMs, 0);
    return {
        startedAt: '2026-07-31T10:00:00.000Z',
        completedAt: '2026-07-31T10:00:01.000Z',
        dataset: {id: 'dataset', version: 1},
        selection: {scenarioIds: fixtures.map(({id}) => id), repeat},
        results,
        summary: {
            total: results.length,
            passed,
            failed: results.length - passed,
            incomplete: 0,
            errors: 0,
            totalLatencyMs,
            averageLatencyMs: totalLatencyMs / results.length
        }
    };
};

describe('query experiment support', () =>
{
    test('loads and adapts the versioned semantic-query experiment fixture', async () =>
    {
        const scenarios = await loadEvaluationScenarios(
            join(process.cwd(), 'data', 'experiments', 'semantic-query-v1.jsonl')
        );
        expect(projectBillableRuns(scenarios, 1)).toMatchObject({
            experimentId: 'semantic-query-v1',
            cases: 3,
            paraphrases: 9,
            runsPerArm: 9,
            totalRuns: 18
        });
        expect(scenarios.flatMap((fixture) => [
            adaptScenarioForArm(fixture, 'control').expectedTools,
            adaptScenarioForArm(fixture, 'semantic').expectedTools
        ])).toEqual(scenarios.flatMap(() => [['query_dataset'], ['semantic_query']]));
    });

    test('adapts arm-neutral tools and output assertions but rejects SQL semantics for the semantic arm', () =>
    {
        const semantic = adaptScenarioForArm(fixtures[0]!, 'semantic');
        expect(semantic.expectedTools).toEqual(['semantic_query']);
        expect(semantic.mustNotInvoke).toEqual(['query_dataset', 'prepare_action']);
        expect(semantic.deterministicAssertions?.map((assertion) =>
            'tool' in assertion ? assertion.tool : undefined
        )).toEqual(['semantic_query', 'semantic_query', 'semantic_query']);

        const sqlFixture: EvaluationScenario = {
            ...fixtures[0]!,
            dataAssertions: ['uses customer tier'],
            deterministicAssertions: [{
                source: 'sql_semantics', label: 'uses customer tier', tool: 'query_dataset',
                operator: 'groups_by', expected: ['customers.tier']
            }]
        };
        expect(() => adaptScenarioForArm(sqlFixture, 'semantic')).toThrow('SQL-specific assertion');
        expect(adaptScenarioForArm(sqlFixture, 'control').expectedTools).toEqual(['query_dataset']);
    });

    test('calculates a bounded two-arm billable-run projection', () =>
    {
        expect(projectBillableRuns(fixtures, 3)).toEqual({
            experimentId: 'semantic-ab-v1',
            cases: 1,
            paraphrases: 2,
            repeat: 3,
            runsPerArm: 6,
            totalRuns: 12,
            maximumRuns: MAX_PROJECTED_BILLABLE_RUNS
        });
        expect(() => projectBillableRuns(fixtures, 4)).toThrow('Repeat count');
        expect(() => projectBillableRuns([{...fixtures[0]!, experiment: undefined}], 1)).toThrow('missing experiment');
        expect(() => projectBillableRuns([
            fixtures[0]!,
            {...fixtures[1]!, experiment: fixtures[0]!.experiment}
        ], 1)).toThrow('Duplicate experiment case/paraphrase');
        expect(() => projectBillableRuns([{
            ...fixtures[0]!,
            execution: {mode: 'multi-turn', priorScenarioIds: ['customer-count-conversational']}
        }], 1)).toThrow('single-turn execution');
    });

    test('pairs every iteration and reports arm and case-level evidence', () =>
    {
        const control = reportFor('control', 2);
        const semantic = reportFor('semantic', 2, (fixture, iteration) =>
            fixture.id === 'customer-count-conversational' && iteration === 2 ? {
                passed: false,
                exactTool: false,
                deterministic: false,
                exactUi: false,
                latencyMs: 200,
                tokens: 40,
                rounds: 3,
                rejectedAttempts: 1
            } : {latencyMs: 150, tokens: 30, rounds: 2}
        );
        const comparison = compareQueryExperiment(fixtures, control, semantic);

        expect(comparison.pairs).toHaveLength(4);
        expect(comparison.pairs[0]?.key).toMatch(/^customer-count-/);
        expect(comparison.arms.control.pass).toEqual({passed: 4, total: 4, rate: 1});
        expect(comparison.arms.semantic.pass).toEqual({passed: 3, total: 4, rate: 0.75});
        expect(comparison.arms.semantic.exactTool.rate).toBe(0.75);
        expect(comparison.arms.semantic.deterministic.rate).toBe(0.75);
        expect(comparison.arms.semantic.denotation.rate).toBe(0.75);
        expect(comparison.arms.semantic.firstAttempt.rate).toBe(0.75);
        expect(comparison.arms.semantic.sqlSemantics).toEqual({passed: 0, total: 0, rate: 0});
        expect(comparison.arms.semantic.ui.rate).toBe(0.75);
        expect(comparison.arms.semantic.latencyMs.average).toBe(162.5);
        expect(comparison.arms.semantic.tokens.average).toBe(32.5);
        expect(comparison.arms.semantic.rounds.average).toBe(2.25);
        expect(comparison.arms.semantic.rejectedAttempts).toEqual({runs: 1, total: 1, rate: 0.25});
        expect(comparison.arms.semantic.runToRun).toEqual({
            repeatedScenarios: 2,
            passStability: {passed: 1, total: 2, rate: 0.5},
            denotationStability: {passed: 1, total: 2, rate: 0.5},
            firstAttemptStability: {passed: 1, total: 2, rate: 0.5},
            uiStability: {passed: 1, total: 2, rate: 0.5},
            latencyRangeMs: {total: 50, average: 25, observedRuns: 2},
            tokenRange: {total: 10, average: 5, observedRuns: 2}
        });
        expect(comparison.cases).toEqual([{
            caseId: 'customer-count',
            paraphraseIds: ['conversational', 'direct'],
            allParaphrasesPass: {control: true, semantic: false, paired: false},
            allParaphrasesDenotationPass: {control: true, semantic: false, paired: false}
        }]);
    });

    test('fails closed for missing, mis-keyed, or wrong-arm results', () =>
    {
        const control = reportFor('control', 2);
        const missing = reportFor('semantic', 2);
        missing.results.pop();
        expect(() => compareQueryExperiment(fixtures, control, missing)).toThrow('results; expected');

        const wrongArm = reportFor('semantic', 2);
        wrongArm.results[0]!.expectations.expectedTools = ['query_dataset'];
        expect(() => compareQueryExperiment(fixtures, control, wrongArm)).toThrow('wrong arm');

        const misKeyed = reportFor('semantic', 2);
        misKeyed.results[0]!.runId = `${misKeyed.results[0]!.scenarioId}:3:semantic-run`;
        expect(() => compareQueryExperiment(fixtures, control, misKeyed)).toThrow('valid scenario iteration');

        const misalignedTrace = reportFor('semantic', 2);
        misalignedTrace.results[0]!.trace.runId = 'different-run';
        expect(() => compareQueryExperiment(fixtures, control, misalignedTrace)).toThrow('misaligned result or trace');
    });
});
