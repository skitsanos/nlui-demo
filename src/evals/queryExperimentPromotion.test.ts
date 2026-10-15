import {describe, expect, test} from 'bun:test';
import type {QueryExperimentComparison} from './queryExperiment.ts';
import {evaluateQueryExperimentPromotion} from './queryExperimentPromotion.ts';

const statistic = (passed: number, total: number) => ({
    passed,
    total,
    rate: total === 0 ? 0 : passed / total
});

interface ArmOutcome
{
    deterministic: [number, number];
    denotation: [number, number];
    firstAttempt: [number, number];
    pass: [number, number];
    ui: [number, number];
}

const arm = (outcome: ArmOutcome) => ({
    runs: outcome.pass[1],
    pass: statistic(...outcome.pass),
    deterministic: statistic(...outcome.deterministic),
    denotation: statistic(...outcome.denotation),
    firstAttempt: statistic(...outcome.firstAttempt),
    ui: statistic(...outcome.ui)
}) as QueryExperimentComparison['arms']['control'];

const full = (pass: [number, number]): ArmOutcome => ({
    deterministic: [pass[1], pass[1]],
    denotation: [pass[1], pass[1]],
    firstAttempt: [pass[1], pass[1]],
    pass,
    ui: [pass[1], pass[1]]
});

const comparison = (
    control: ArmOutcome,
    semantic: ArmOutcome,
    scenarioIds = ['scenario-a', 'scenario-b'],
    repeat = 2
): QueryExperimentComparison => ({
    experimentId: 'semantic-query-v2',
    repeat,
    pairs: scenarioIds.flatMap((scenarioId) => Array.from(
        {length: repeat},
        (_value, index) => ({scenarioId, iteration: index + 1})
    )) as QueryExperimentComparison['pairs'],
    cases: [],
    arms: {control: arm(control), semantic: arm(semantic)}
});

const requiredScenarioIds = ['scenario-a', 'scenario-b'];

describe('semantic query promotion gate', () =>
{
    test('marks a full-corpus treatment only with perfect semantics, UI, first attempts, and better reliability', () =>
    {
        const decision = evaluateQueryExperimentPromotion(
            comparison(full([2, 4]), full([4, 4])),
            requiredScenarioIds
        );

        expect(decision.eligible).toBeTrue();
        expect(decision.recommendation).toBe('semantic_candidate');
        expect(decision.checks.every(({passed}) => passed)).toBeTrue();
    });

    test('retains control for partial coverage, too few repeats, or no reliability gain', () =>
    {
        for (const candidate of [
            comparison(full([1, 2]), full([2, 2]), ['scenario-a']),
            comparison(full([1, 2]), full([2, 2]), requiredScenarioIds, 1),
            comparison(full([4, 4]), full([4, 4]))
        ])
        {
            expect(evaluateQueryExperimentPromotion(candidate, requiredScenarioIds).eligible).toBeFalse();
        }
    });

    test('retains control for denotation, UI, or first-attempt regressions', () =>
    {
        const failures: ArmOutcome[] = [
            {...full([4, 4]), deterministic: [3, 4]},
            {...full([4, 4]), denotation: [3, 4]},
            {...full([4, 4]), ui: [3, 4]},
            {...full([4, 4]), firstAttempt: [3, 4]}
        ];
        for (const semantic of failures)
        {
            const decision = evaluateQueryExperimentPromotion(
                comparison(full([2, 4]), semantic),
                requiredScenarioIds
            );
            expect(decision.eligible).toBeFalse();
            expect(decision.recommendation).toBe('retain_control');
        }
    });

    test('retains control when a full-corpus run is not fully graded', () =>
    {
        const semantic = {
            ...full([4, 4]),
            denotation: [3, 3] as [number, number],
            firstAttempt: [3, 3] as [number, number]
        };
        const decision = evaluateQueryExperimentPromotion(
            comparison(full([2, 4]), semantic),
            requiredScenarioIds
        );

        expect(decision.eligible).toBeFalse();
        expect(decision.checks.find(({id}) => id === 'complete_semantic_denotation')?.passed).toBeFalse();
        expect(decision.checks.find(({id}) => id === 'complete_semantic_first_attempt')?.passed).toBeFalse();
    });

    test('retains control for missing or incomplete deterministic evidence despite a reliability gain', () =>
    {
        for (const counts of [[3, 3], [0, 0]] as Array<[number, number]>)
        {
            const candidate = comparison(full([2, 4]), {...full([3, 4]), deterministic: counts});
            const decision = evaluateQueryExperimentPromotion(candidate, requiredScenarioIds);
            expect(decision.eligible).toBeFalse();
            expect(decision.checks.find(({id}) => id === 'complete_semantic_deterministic')?.passed).toBeFalse();
        }
        const legacy = comparison(full([2, 4]), full([4, 4]));
        Reflect.deleteProperty(legacy.arms.semantic, 'deterministic');
        expect(evaluateQueryExperimentPromotion(legacy, requiredScenarioIds).eligible).toBeFalse();
    });
    test('never promotes a candidate containing an incomplete/error run even if all recorded assertions pass', () =>
    {
        const decision = evaluateQueryExperimentPromotion(comparison(full([1, 4]), full([3, 4])), requiredScenarioIds);
        expect(decision.checks.find(({id}) => id === 'reliability_improvement')?.passed).toBeTrue();
        expect(decision.checks.find(({id}) => id === 'complete_semantic_runs')?.passed).toBeFalse();
        expect(decision.eligible).toBeFalse();
    });
});
