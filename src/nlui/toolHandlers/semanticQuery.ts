import {queryParameterizedDataset} from '../../data/queryDataset.ts';
import {compileSemanticQuery, SEMANTIC_METRICS} from '../../data/semantic/index.ts';
import {semanticQueryArguments} from '../toolArguments.ts';
import type {ToolExecution} from '../toolTypes.ts';
import {renderDatasetResult} from './queryDataset.ts';

const record = (value: unknown): Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};

export const semanticQueryHandler = async (raw: unknown): Promise<ToolExecution> =>
{
    const args = semanticQueryArguments.parse(raw);
    const compiled = compileSemanticQuery({
        metric: args.plan.metric,
        dimensions: args.plan.dimensions,
        filters: args.plan.filters,
        ...args.plan.timeRange && {timeRange: args.plan.timeRange},
        ...args.plan.orderBy && {orderBy: args.plan.orderBy},
        ...args.plan.limit !== null && {limit: args.plan.limit}
    });
    const rendered = renderDatasetResult(
        await queryParameterizedDataset(compiled.sql, compiled.parameters),
        args.title,
        args.presentation
    );
    const metric = SEMANTIC_METRICS[compiled.plan.metric];

    return {
        modelOutput: rendered.modelOutput,
        traceOutput: {
            ...record(rendered.traceOutput),
            semanticPlan: compiled.plan,
            planHash: compiled.planHash,
            relationships: compiled.relationships,
            metric: {
                id: metric.id,
                unit: metric.unit,
                grain: metric.grain
            }
        },
        blocks: rendered.blocks
    };
};
