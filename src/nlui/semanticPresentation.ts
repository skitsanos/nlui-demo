import type {DatasetQueryResult} from '../data/queryTypes.ts';
import type {CanonicalSemanticQuery} from '../data/semantic/index.ts';
import type {DatasetPresentation} from './toolHandlers/queryDataset.ts';

export const SEMANTIC_PRESENTATION_POLICY_VERSION = 1;

export interface SemanticPresentationDecision
{
    presentation: DatasetPresentation;
    reason: 'scalar_metric' | 'time_series' | 'categorical_breakdown' | 'record_set';
}

type PresentationPlan = Pick<CanonicalSemanticQuery, 'metric' | 'dimensions'>;

const normalizedName = (value: string): string => value.trim().toLowerCase();

const hasExactSemanticShape = (
    plan: PresentationPlan,
    result: DatasetQueryResult
): boolean =>
{
    const expectedNames = [...plan.dimensions, plan.metric].map(normalizedName);
    const actualNames = result.columns.map(({name}) => normalizedName(name));
    return actualNames.length === expectedNames.length
        && expectedNames.every((name) => actualNames.includes(name));
};

const hasNumericMetric = (
    plan: PresentationPlan,
    result: DatasetQueryResult
): boolean => result.columns.some((column) =>
    normalizedName(column.name) === normalizedName(plan.metric) && column.kind === 'number');

export const semanticPresentationFor = (
    plan: PresentationPlan,
    result: DatasetQueryResult
): SemanticPresentationDecision =>
{
    const trustedAggregateShape = hasExactSemanticShape(plan, result)
        && hasNumericMetric(plan, result);

    if (trustedAggregateShape && plan.dimensions.length === 0 && result.rows.length <= 1)
    {
        return {presentation: 'metric', reason: 'scalar_metric'};
    }
    if (trustedAggregateShape && plan.dimensions.length === 1
        && result.rows.length >= 2 && result.rows.length <= 24)
    {
        return plan.dimensions[0] === 'month'
            ? {presentation: 'line', reason: 'time_series'}
            : {presentation: 'bar', reason: 'categorical_breakdown'};
    }
    return {presentation: 'table', reason: 'record_set'};
};
