import type {QueryExperimentComparison} from './queryExperiment.ts';

export interface QueryExperimentPromotionCheck
{
    id: 'full_corpus_coverage'
        | 'complete_semantic_denotation'
        | 'no_denotation_regression'
        | 'complete_semantic_ui'
        | 'no_ui_regression'
        | 'complete_semantic_first_attempt'
        | 'no_first_attempt_regression'
        | 'reliability_improvement';
    passed: boolean;
    detail: string;
}

export interface QueryExperimentPromotionDecision
{
    eligible: boolean;
    recommendation: 'semantic_candidate' | 'retain_control';
    checks: QueryExperimentPromotionCheck[];
}

const percentage = (value: number): string => `${(value * 100).toFixed(1)}%`;
export const MINIMUM_PROMOTION_REPEAT_COUNT = 2;

const sameValues = (left: string[], right: string[]): boolean =>
    left.length === right.length && left.every((value, index) => value === right[index]);

export const evaluateQueryExperimentPromotion = (
    comparison: QueryExperimentComparison,
    requiredScenarioIds: string[]
): QueryExperimentPromotionDecision =>
{
    const {control, semantic} = comparison.arms;
    const requiredIds = [...new Set(requiredScenarioIds)].toSorted();
    const observedIds = [...new Set(comparison.pairs.map(({scenarioId}) => scenarioId))].toSorted();
    const pairedRuns = comparison.pairs.length;
    const fullCorpusCoverage = requiredIds.length > 0
        && comparison.repeat >= MINIMUM_PROMOTION_REPEAT_COUNT
        && comparison.pairs.length === requiredIds.length * comparison.repeat
        && sameValues(observedIds, requiredIds);
    const completeSemanticDenotation = semantic.denotation.total === pairedRuns
        && semantic.denotation.passed === pairedRuns;
    const noDenotationRegression = semantic.denotation.total === pairedRuns
        && control.denotation.total === pairedRuns
        && semantic.denotation.rate >= control.denotation.rate;
    const completeSemanticUi = semantic.ui.total === pairedRuns && semantic.ui.passed === pairedRuns;
    const noUiRegression = semantic.ui.total === pairedRuns && control.ui.total === pairedRuns
        && semantic.ui.rate >= control.ui.rate;
    const completeSemanticFirstAttempt = semantic.firstAttempt.total === pairedRuns
        && semantic.firstAttempt.passed === pairedRuns;
    const noFirstAttemptRegression = semantic.firstAttempt.total === pairedRuns
        && control.firstAttempt.total === pairedRuns
        && semantic.firstAttempt.rate >= control.firstAttempt.rate;
    const reliabilityImprovement = semantic.pass.total === pairedRuns && control.pass.total === pairedRuns
        && semantic.pass.rate > control.pass.rate;
    const checks: QueryExperimentPromotionCheck[] = [
        {
            id: 'full_corpus_coverage',
            passed: fullCorpusCoverage,
            detail: `${observedIds.length}/${requiredIds.length} scenarios across ${comparison.repeat} repeat(s)`
        },
        {
            id: 'complete_semantic_denotation',
            passed: completeSemanticDenotation,
            detail: `${semantic.denotation.passed}/${semantic.denotation.total} semantic denotations passed`
        },
        {
            id: 'no_denotation_regression',
            passed: noDenotationRegression,
            detail: `semantic ${percentage(semantic.denotation.rate)} vs control ${percentage(control.denotation.rate)}`
        },
        {
            id: 'complete_semantic_ui',
            passed: completeSemanticUi,
            detail: `${semantic.ui.passed}/${semantic.ui.total} semantic renderer checks passed`
        },
        {
            id: 'no_ui_regression',
            passed: noUiRegression,
            detail: `semantic ${percentage(semantic.ui.rate)} vs control ${percentage(control.ui.rate)}`
        },
        {
            id: 'complete_semantic_first_attempt',
            passed: completeSemanticFirstAttempt,
            detail: `${semantic.firstAttempt.passed}/${semantic.firstAttempt.total} first attempts passed`
        },
        {
            id: 'no_first_attempt_regression',
            passed: noFirstAttemptRegression,
            detail: `semantic ${percentage(semantic.firstAttempt.rate)} vs control ${percentage(control.firstAttempt.rate)}`
        },
        {
            id: 'reliability_improvement',
            passed: reliabilityImprovement,
            detail: `semantic ${percentage(semantic.pass.rate)} vs control ${percentage(control.pass.rate)} complete passes`
        }
    ];
    const eligible = checks.every(({passed}) => passed);
    return {
        eligible,
        recommendation: eligible ? 'semantic_candidate' : 'retain_control',
        checks
    };
};
