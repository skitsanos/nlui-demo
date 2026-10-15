import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {queryDataset} from '../data/queryDataset.ts';
import type {DatasetQueryCell, DatasetQueryResult} from '../data/queryTypes.ts';
import {resetDemoDatabase} from '../data/seed.ts';
import {evaluateTrace} from './evaluate.ts';
import type {QueryExperimentComparison} from './queryExperiment.ts';
import {evaluateQueryExperimentPromotion} from './queryExperimentPromotion.ts';
import {summarizeArmRuns} from './queryExperimentStatistics.ts';
import type {DeterministicAssertion, EvaluationScenario} from './scenario.ts';
import type {EvaluationResult, EvaluationTrace} from './types.ts';

let directory: string;
let databasePath: string;
beforeAll(() =>
{
    directory = mkdtempSync(join(tmpdir(), 'nlui-predicate-evaluation-'));
    databasePath = join(directory, 'demo.sqlite');
    resetDemoDatabase({databasePath});
});
afterAll(() => {if (directory) rmSync(directory, {recursive: true, force: true});});

const equality: DeterministicAssertion = {
    source: 'tool_arguments', label: 'gold filter', tool: 'query_dataset', operator: 'sql_where_equals',
    expected: {column: 'tier', value: 'gold'}
};
const exclusions: DeterministicAssertion = {
    source: 'sql_semantics', label: 'eligible revenue', tool: 'query_dataset', operator: 'excludes_values',
    expected: {column: 'orders.status', values: ['cancelled', 'returned']}
};
const fixture = (predicate: DeterministicAssertion, expected: DatasetQueryCell[][]): EvaluationScenario => ({
    id: 'predicate-proof', category: 'analytics', prompt: 'Verify the requested data scope.',
    expectedTools: ['query_dataset'], expectedBlocks: ['markdown'], mustNotInvoke: [],
    dataAssertions: [predicate.label, 'denotation', 'first attempt'],
    deterministicAssertions: [predicate, {
        source: 'denotation', label: 'denotation', tool: 'query_dataset', path: 'denotationTuples',
        operator: 'exact', expected, arrayOrder: 'ordered'
    }, {
        source: 'tool_sequence', label: 'first attempt', tool: 'query_dataset', operator: 'successful_attempt_equals',
        expected: 1
    }]
});
const trace = (sql: unknown, modelOutput: unknown): EvaluationTrace => ({
    scenarioId: 'predicate-proof', runId: 'predicate-proof:1:test',
    startedAt: '2026-10-15T10:00:00Z', completedAt: '2026-10-15T10:00:01Z',
    events: [], text: 'A bounded dataset result.', toolCalls: ['query_dataset'],
    toolExecutions: [{round: 1, callId: 'query', name: 'query_dataset', arguments: {sql}, modelOutput,
        candidateBlockIds: [], candidateBlockTypes: [], durationMs: 1, cached: false, rejected: false}],
    blocks: [], responseIds: ['fixture-response'], latency: {totalMs: 1}
});
const tuples = (result: DatasetQueryResult): DatasetQueryCell[][] =>
    result.rows.map((row) => result.columns.map(({key}) => row[key]));
const grade = async (scenario: EvaluationScenario, sql: string): Promise<EvaluationResult> =>
    evaluateTrace(scenario, trace(sql, await queryDataset(sql, {databasePath})));

describe('predicate evidence against the existing seeded SQLite dataset', () =>
{
    test('rejects broadening, negation and CASE using actual query denotations', async () =>
    {
        const correct = "SELECT COUNT(*) AS n FROM customers WHERE tier = 'gold'";
        const expected = tuples(await queryDataset(correct, {databasePath}));
        expect(expected).toEqual([[20]]);
        const scenario = fixture(equality, expected);
        expect((await grade(scenario, correct)).status).toBe('passed');
        for (const predicate of ["tier = 'gold' OR 1 = 1", "NOT tier = 'gold'",
            "(tier = 'gold') = 0", "CASE WHEN tier = 'gold' THEN 1 ELSE 1 END = 1"])
        {
            const result = await grade(scenario, `SELECT COUNT(*) AS n FROM customers WHERE ${predicate}`);
            expect(result.status).toBe('failed');
            expect(result.dataAssertions.map(({status}) => status)).toEqual(['failed', 'failed', 'passed']);
        }
    });

    test('proves equivalent exclusions and rejects revenue from ineffective alternatives', async () =>
    {
        const select = 'SELECT SUM(total_cents) AS revenue_cents FROM orders WHERE';
        const correct = `${select} status NOT IN ('cancelled', 'returned')`;
        const scenario = fixture(exclusions, tuples(await queryDataset(correct, {databasePath})));
        expect((await grade(scenario, correct)).status).toBe('passed');
        expect((await grade(scenario, `${select} 'returned' <> status AND status != 'cancelled'`)).status).toBe('passed');
        for (const predicate of ["status NOT IN ('cancelled', 'returned') OR 1 = 1",
            "status != 'cancelled' OR status != 'returned'", "NOT status NOT IN ('cancelled', 'returned')"])
        {
            const result = await grade(scenario, `${select} ${predicate}`);
            expect(result.dataAssertions.map(({status}) => status)).toEqual(['failed', 'failed', 'passed']);
        }
    });

    test('keeps matching denotation separate from proof and carries failures into promotion', async () =>
    {
        const select = 'SELECT COUNT(DISTINCT region) AS n FROM customers WHERE';
        const correct = `${select} tier = 'gold' AND region = 'West'`;
        const expected = tuples(await queryDataset(correct, {databasePath}));
        expect(expected).toEqual([[1]]);
        const scenario = fixture(equality, expected);
        const good = await grade(scenario, correct);
        const bad = await grade(scenario, `${select} (tier = 'gold' OR 1 = 1) AND region = 'West'`);
        expect(good.status).toBe('passed');
        expect(bad.dataAssertions.map(({status}) => status)).toEqual(['failed', 'passed', 'passed']);
        expect(bad.status).toBe('failed');

        // Unit-test the promotion consumer with graded evidence, not a live semantic-query experiment.
        const runs = [good, bad].map((result) => ({scenarioId: scenario.id, observation: {
            passed: result.status === 'passed', exactTool: true,
            deterministic: result.dataAssertions.every(({status}) => status === 'passed'),
            denotation: result.dataAssertions[1]?.status === 'passed',
            firstAttempt: result.dataAssertions[2]?.status === 'passed',
            ui: true, latencyMs: 1, rounds: 1, rejectedAttempts: 0
        }}));
        const candidate = summarizeArmRuns(runs);
        const controlRuns = runs.map((run) => ({...run, observation: {...run.observation, passed: false}}));
        const control = summarizeArmRuns(controlRuns);
        const comparison: QueryExperimentComparison = {
            experimentId: 'predicate-regression', repeat: 2, cases: [],
            pairs: [1, 2].map((iteration) => ({
                key: `${scenario.id}:${iteration}`, scenarioId: scenario.id, iteration,
                caseId: 'scope', paraphraseId: 'filter', control: controlRuns[iteration - 1]!.observation,
                semantic: runs[iteration - 1]!.observation
            })),
            arms: {control, semantic: candidate}
        };
        const decision = evaluateQueryExperimentPromotion(comparison, [scenario.id]);
        expect(decision.checks.filter(({id}) => !['complete_semantic_deterministic', 'complete_semantic_runs'].includes(id))
            .every(({passed}) => passed)).toBeTrue();
        expect(decision.checks.find(({id}) => id === 'complete_semantic_deterministic')?.passed).toBeFalse();
        expect(decision.recommendation).toBe('retain_control');
    });

    test('malformed, missing and unsupported SQL evidence fails assertions without aborting evaluation', async () =>
    {
        const modelOutput = await queryDataset("SELECT COUNT(*) AS n FROM customers WHERE tier = 'gold'", {databasePath});
        const scenario = fixture(equality, tuples(modelOutput));
        for (const sql of [undefined, 42, '', 'not SQL', "SELECT COUNT(*) AS n FROM customers WHERE NOT(tier = 'gold')",
            "WITH gold_customers AS (SELECT id FROM customers WHERE tier = 'gold') SELECT COUNT(*) AS n FROM gold_customers"])
        {
            const result = await evaluateTrace(scenario, trace(sql, modelOutput));
            expect(result.status).toBe('failed');
            expect(result.dataAssertions.map(({status}) => status)).toEqual(['failed', 'passed', 'passed']);
        }
    });
});
