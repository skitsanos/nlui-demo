import {z} from 'zod';
import {DATASET_REFERENCE_DATE} from '../constants.ts';
import {
    CUSTOMER_REGIONS,
    CUSTOMER_TIERS,
    ORDER_STATUSES,
    SEMANTIC_DIMENSION_IDS,
    SEMANTIC_METRIC_IDS,
    SEMANTIC_METRICS
} from './catalog.ts';

const calendarDateSchema = z.string().refine((value) =>
{
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day;
}, 'Expected a valid calendar date in YYYY-MM-DD format');

const monthSchema = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/, 'Expected a month in YYYY-MM format');
const directionSchema = z.enum(['asc', 'desc']);

const filterSchemas = [
    z.object({
        dimension: z.literal('month'),
        values: z.array(monthSchema).min(1).max(24)
    }).strict(),
    z.object({
        dimension: z.literal('region'),
        values: z.array(z.enum(CUSTOMER_REGIONS)).min(1).max(CUSTOMER_REGIONS.length)
    }).strict(),
    z.object({
        dimension: z.literal('customer_tier'),
        values: z.array(z.enum(CUSTOMER_TIERS)).min(1).max(CUSTOMER_TIERS.length)
    }).strict(),
    z.object({
        dimension: z.literal('order_status'),
        values: z.array(z.enum(ORDER_STATUSES)).min(1).max(ORDER_STATUSES.length)
    }).strict()
] as const;

export const semanticFilterSchema = z.discriminatedUnion('dimension', filterSchemas);

const datasetReferenceDay = DATASET_REFERENCE_DATE.slice(0, 10);

export const semanticTimeRangeSchema = z.object({
    from: calendarDateSchema,
    to: calendarDateSchema
}).strict().superRefine(({from, to}, context) =>
{
    if (from > to)
    {
        context.addIssue({code: 'custom', message: 'Time range start must not be after its end', path: ['to']});
    }
    if (to > datasetReferenceDay)
    {
        context.addIssue({
            code: 'custom',
            message: `Observed periods cannot extend beyond the dataset snapshot on ${datasetReferenceDay}`,
            path: ['to']
        });
    }
});

export const semanticOrderSchema = z.object({
    field: z.union([z.literal('metric'), z.enum(SEMANTIC_DIMENSION_IDS)]),
    direction: directionSchema
}).strict();

export const semanticQuerySchema = z.object({
    metric: z.enum(SEMANTIC_METRIC_IDS),
    dimensions: z.array(z.enum(SEMANTIC_DIMENSION_IDS)).max(3).default([]),
    filters: z.array(semanticFilterSchema).max(4).default([]),
    timeRange: semanticTimeRangeSchema.optional(),
    orderBy: semanticOrderSchema.optional(),
    limit: z.number().int().min(1).max(100).optional()
}).strict().superRefine((plan, context) =>
{
    const metric = SEMANTIC_METRICS[plan.metric];
    const compatible = new Set<string>(metric.compatibleDimensions);
    const duplicateDimensions = plan.dimensions.filter((dimension, index) =>
        plan.dimensions.indexOf(dimension) !== index);
    if (duplicateDimensions.length > 0)
    {
        context.addIssue({
            code: 'custom',
            message: `Dimensions must be unique: ${[...new Set(duplicateDimensions)].join(', ')}`,
            path: ['dimensions']
        });
    }

    for (const [index, dimension] of plan.dimensions.entries())
    {
        if (!compatible.has(dimension))
        {
            context.addIssue({
                code: 'custom',
                message: `${dimension} is incompatible with ${plan.metric}`,
                path: ['dimensions', index]
            });
        }
    }

    const filteredDimensions = new Set<string>();
    for (const [index, filter] of plan.filters.entries())
    {
        if (filteredDimensions.has(filter.dimension))
        {
            context.addIssue({
                code: 'custom',
                message: `Only one filter is allowed for ${filter.dimension}`,
                path: ['filters', index, 'dimension']
            });
        }
        filteredDimensions.add(filter.dimension);
        if (!compatible.has(filter.dimension))
        {
            context.addIssue({
                code: 'custom',
                message: `${filter.dimension} is incompatible with ${plan.metric}`,
                path: ['filters', index]
            });
        }
        if (new Set(filter.values).size !== filter.values.length)
        {
            context.addIssue({
                code: 'custom',
                message: 'Filter values must be unique',
                path: ['filters', index, 'values']
            });
        }
        const excludedStatuses = metric.excludedOrderStatuses;
        if (filter.dimension === 'order_status'
            && excludedStatuses?.some((status) => filter.values.includes(status)))
        {
            context.addIssue({
                code: 'custom',
                message: `${plan.metric} excludes cancelled and returned orders by definition`,
                path: ['filters', index, 'values']
            });
        }
    }

    if (metric.timeScope.kind === 'lifetime' && plan.timeRange)
    {
        context.addIssue({
            code: 'custom',
            message: `${plan.metric} is a lifetime metric and does not accept a time range`,
            path: ['timeRange']
        });
    }
    if (metric.timeScope.kind === 'period'
        && metric.timeScope.requirement === 'required'
        && !plan.timeRange)
    {
        context.addIssue({
            code: 'custom',
            message: `${plan.metric} requires an explicit time range`,
            path: ['timeRange']
        });
    }
    if (plan.orderBy?.field !== undefined && plan.orderBy.field !== 'metric'
        && !plan.dimensions.includes(plan.orderBy.field))
    {
        context.addIssue({
            code: 'custom',
            message: 'Ordering by a dimension requires grouping by that dimension',
            path: ['orderBy', 'field']
        });
    }
    if (plan.limit !== undefined && plan.dimensions.length === 0)
    {
        context.addIssue({
            code: 'custom',
            message: 'A row limit is only meaningful for a grouped query',
            path: ['limit']
        });
    }
});

export type SemanticFilter = z.infer<typeof semanticFilterSchema>;
export type SemanticQuery = z.infer<typeof semanticQuerySchema>;
export type SemanticTimeRange = z.infer<typeof semanticTimeRangeSchema>;
