import {createHash} from 'node:crypto';
import {DATASET_REFERENCE_DATE} from '../constants.ts';
import {
    SEMANTIC_CATALOG_ID,
    SEMANTIC_CATALOG_VERSION,
    SEMANTIC_DIMENSIONS,
    SEMANTIC_METRICS,
    SEMANTIC_RELATIONSHIPS,
    type SemanticDimensionId,
    type SemanticEntity,
    type SemanticMetricId,
    type SemanticRelationshipId
} from './catalog.ts';
import {type SemanticFilter, type SemanticQuery, semanticQuerySchema} from './schema.ts';

type SqlParameter = string | number;

interface DimensionSource
{
    expression: string;
    relationship?: SemanticRelationshipId;
}

export interface CanonicalSemanticQuery
{
    catalogId: typeof SEMANTIC_CATALOG_ID;
    catalogVersion: typeof SEMANTIC_CATALOG_VERSION;
    metric: SemanticMetricId;
    dimensions: SemanticDimensionId[];
    filters: Array<{dimension: SemanticDimensionId; values: string[]}>;
    timeRange: {from: string; to: string} | null;
    orderBy: {field: 'metric' | SemanticDimensionId; direction: 'asc' | 'desc'} | null;
    limit: number | null;
}

export interface CompiledSemanticQuery
{
    plan: CanonicalSemanticQuery;
    planHash: string;
    sql: string;
    parameters: SqlParameter[];
    relationships: SemanticRelationshipId[];
}

const sourceFor = (dimension: SemanticDimensionId, entity: SemanticEntity): DimensionSource =>
{
    const sources = SEMANTIC_DIMENSIONS[dimension].sources as Partial<Record<SemanticEntity, DimensionSource>>;
    const source = sources[entity];
    if (!source)
    {
        throw new Error(`Semantic catalog has no ${entity} source for ${dimension}`);
    }
    return source;
};

const canonicalFilter = (filter: SemanticFilter): CanonicalSemanticQuery['filters'][number] => ({
    dimension: filter.dimension,
    values: [...filter.values].sort((left, right) => left.localeCompare(right))
});

const sameValues = (left: readonly string[], right: readonly string[]): boolean =>
    left.length === right.length && left.every((value, index) => value === right[index]);

const monthsTouchedBy = (timeRange: {from: string; to: string}, maximum = 100): string[] | null =>
{
    let year = Number(timeRange.from.slice(0, 4));
    let month = Number(timeRange.from.slice(5, 7));
    const endYear = Number(timeRange.to.slice(0, 4));
    const endMonth = Number(timeRange.to.slice(5, 7));
    const months: string[] = [];
    while (year < endYear || (year === endYear && month <= endMonth))
    {
        months.push(`${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}`);
        if (months.length > maximum) return null;
        month += 1;
        if (month === 13)
        {
            year += 1;
            month = 1;
        }
    }
    return months;
};

const effectiveFilterValues = (
    metricId: SemanticMetricId,
    dimension: SemanticDimensionId
): string[] | null =>
{
    const values = SEMANTIC_DIMENSIONS[dimension].filterValues;
    if (!values) return null;
    const excluded = new Set<string>(dimension === 'order_status'
        ? SEMANTIC_METRICS[metricId].excludedOrderStatuses ?? []
        : []);
    return values
        .filter((value) => !excluded.has(value))
        .sort((left, right) => left.localeCompare(right));
};

const canonicalFilters = (
    metricId: SemanticMetricId,
    filters: SemanticFilter[],
    timeRange: CanonicalSemanticQuery['timeRange']
): CanonicalSemanticQuery['filters'] =>
{
    const rangeMonths = timeRange ? monthsTouchedBy(timeRange, 24) : null;
    return filters
        .map(canonicalFilter)
        .filter((filter) =>
        {
            const exhaustiveValues = effectiveFilterValues(metricId, filter.dimension);
            if (exhaustiveValues && sameValues(filter.values, exhaustiveValues)) return false;
            return filter.dimension !== 'month'
                || !rangeMonths
                || !sameValues(filter.values, rangeMonths);
        })
        .sort((left, right) => left.dimension.localeCompare(right.dimension));
};

const cardinalityUpperBound = (
    metricId: SemanticMetricId,
    dimensions: SemanticDimensionId[],
    filters: CanonicalSemanticQuery['filters'],
    timeRange: CanonicalSemanticQuery['timeRange']
): number | null =>
{
    let maximumRows = 1;
    for (const dimension of dimensions)
    {
        const filter = filters.find((candidate) => candidate.dimension === dimension);
        const values = filter?.values
            ?? (dimension === 'month' && timeRange ? monthsTouchedBy(timeRange) : null)
            ?? effectiveFilterValues(metricId, dimension);
        if (!values) return null;
        maximumRows *= values.length;
        if (maximumRows > 100) return 101;
    }
    return maximumRows;
};

const canonicalOrder = (
    dimensions: SemanticDimensionId[],
    orderBy: SemanticQuery['orderBy']
): CanonicalSemanticQuery['orderBy'] =>
{
    if (!orderBy) return null;
    if (dimensions.length === 0 && orderBy.field === 'metric') return null;
    if (dimensions.length === 1 && orderBy.field === dimensions[0] && orderBy.direction === 'asc') return null;
    return {...orderBy};
};

export const canonicalizeSemanticQuery = (input: unknown): CanonicalSemanticQuery =>
{
    const plan = semanticQuerySchema.parse(input);
    const dimensions = [...plan.dimensions];
    const timeRange = plan.timeRange ? {...plan.timeRange} : null;
    const filters = canonicalFilters(plan.metric, plan.filters, timeRange);
    const orderBy = canonicalOrder(dimensions, plan.orderBy);
    const maximumRows = cardinalityUpperBound(plan.metric, dimensions, filters, timeRange);
    return {
        catalogId: SEMANTIC_CATALOG_ID,
        catalogVersion: SEMANTIC_CATALOG_VERSION,
        metric: plan.metric,
        dimensions,
        filters,
        timeRange,
        orderBy,
        limit: plan.limit !== undefined && (maximumRows === null || plan.limit < maximumRows)
            ? plan.limit
            : null
    };
};

const planHash = (plan: CanonicalSemanticQuery): string =>
    createHash('sha256').update(JSON.stringify(plan)).digest('hex');

const relationshipIdsFor = (plan: CanonicalSemanticQuery): SemanticRelationshipId[] =>
{
    const entity = SEMANTIC_METRICS[plan.metric].baseEntity;
    const relationships = new Set<SemanticRelationshipId>();
    for (const dimension of [
        ...plan.dimensions,
        ...plan.filters.map(({dimension}) => dimension)
    ])
    {
        const relationship = sourceFor(dimension, entity).relationship;
        if (relationship) relationships.add(relationship);
    }
    return [...relationships].sort((left, right) => left.localeCompare(right));
};

const appendDefaultFilters = (
    plan: CanonicalSemanticQuery,
    clauses: string[],
    parameters: SqlParameter[]
): void =>
{
    const metric = SEMANTIC_METRICS[plan.metric];
    if (metric.excludedOrderStatuses)
    {
        clauses.push(`orders.status NOT IN (${metric.excludedOrderStatuses.map(() => '?').join(', ')})`);
        parameters.push(...metric.excludedOrderStatuses);
    }
};

const appendTimeRange = (
    plan: CanonicalSemanticQuery,
    clauses: string[],
    parameters: SqlParameter[]
): void =>
{
    if (!plan.timeRange) return;
    const {timeScope} = SEMANTIC_METRICS[plan.metric];
    if (timeScope.kind !== 'period') throw new Error(`${plan.metric} cannot compile a time range`);
    clauses.push(`${timeScope.field} >= ?`);
    parameters.push(plan.timeRange.from);
    if (plan.timeRange.to === DATASET_REFERENCE_DATE.slice(0, 10))
    {
        clauses.push(`${timeScope.field} <= ?`);
        parameters.push(DATASET_REFERENCE_DATE);
    }
    else
    {
        clauses.push(`${timeScope.field} < datetime(?, '+1 day')`);
        parameters.push(plan.timeRange.to);
    }
};

const appendDimensionFilters = (
    plan: CanonicalSemanticQuery,
    clauses: string[],
    parameters: SqlParameter[]
): void =>
{
    const entity = SEMANTIC_METRICS[plan.metric].baseEntity;
    for (const filter of plan.filters)
    {
        const {expression} = sourceFor(filter.dimension, entity);
        if (filter.values.length === 1)
        {
            clauses.push(`${expression} = ?`);
        }
        else
        {
            clauses.push(`${expression} IN (${filter.values.map(() => '?').join(', ')})`);
        }
        parameters.push(...filter.values);
    }
};

const queryLines = (
    plan: CanonicalSemanticQuery,
    relationships: SemanticRelationshipId[],
    parameters: SqlParameter[]
): string[] =>
{
    const metric = SEMANTIC_METRICS[plan.metric];
    const dimensionSelections = plan.dimensions.map((dimension) =>
        `${sourceFor(dimension, metric.baseEntity).expression} AS ${dimension}`);
    const lines = [
        'SELECT',
        [...dimensionSelections, `${metric.expression} AS ${plan.metric}`]
            .map((selection) => `    ${selection}`)
            .join(',\n'),
        `FROM ${metric.baseEntity}`
    ];

    for (const relationshipId of relationships)
    {
        const relationship = SEMANTIC_RELATIONSHIPS[relationshipId];
        if (relationship.fromEntity !== metric.baseEntity)
        {
            throw new Error(`Relationship ${relationshipId} cannot start from ${metric.baseEntity}`);
        }
        lines.push(relationship.joinSql);
    }

    const clauses: string[] = [];
    appendDefaultFilters(plan, clauses, parameters);
    appendTimeRange(plan, clauses, parameters);
    appendDimensionFilters(plan, clauses, parameters);
    if (clauses.length > 0) lines.push(`WHERE ${clauses.join('\n    AND ')}`);

    if (plan.dimensions.length > 0)
    {
        const expressions = plan.dimensions.map((dimension) => sourceFor(dimension, metric.baseEntity).expression);
        lines.push(`GROUP BY ${expressions.join(', ')}`);
    }

    if (plan.orderBy)
    {
        const alias = plan.orderBy.field === 'metric' ? plan.metric : plan.orderBy.field;
        lines.push(`ORDER BY ${alias} ${plan.orderBy.direction.toUpperCase()}`);
    }
    else if (plan.dimensions.length > 0)
    {
        lines.push(`ORDER BY ${plan.dimensions.map((dimension) => `${dimension} ASC`).join(', ')}`);
    }

    if (plan.limit !== null)
    {
        lines.push(`LIMIT ${plan.limit}`);
    }
    return lines;
};

export const compileSemanticQuery = (input: unknown): CompiledSemanticQuery =>
{
    const plan = canonicalizeSemanticQuery(input);
    const relationships = relationshipIdsFor(plan);
    const parameters: SqlParameter[] = [];
    return {
        plan,
        planHash: planHash(plan),
        sql: queryLines(plan, relationships, parameters).join('\n'),
        parameters,
        relationships
    };
};

export const parseSemanticQuery = (input: unknown): SemanticQuery => semanticQuerySchema.parse(input);
