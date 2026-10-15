import {QUERY_TABLES} from '../querySchema.ts';
import {SEMANTIC_CATALOG, SEMANTIC_DIMENSIONS, SEMANTIC_METRICS, type SemanticMetricId} from './catalog.ts';

const synonyms: Record<SemanticMetricId, string[]> = {
    registered_customer_count: ['customers now', 'registered customers', 'customer population'],
    customer_registrations: ['new customers', 'signups', 'acquisition'],
    active_customer_count: ['purchasing customers', 'customers with orders'],
    eligible_order_count: ['sales orders', 'non-cancelled orders'],
    eligible_revenue_eur: ['revenue', 'sales total', 'order revenue'],
    average_order_value_eur: ['AOV', 'average basket'],
    merchandise_revenue_eur: ['gross merchandise value', 'line sales', 'merchandise before tax and shipping'],
    completed_refunds_eur: ['completed refunds', 'returned money', 'refund amount']
};

export const semanticCatalogMetadata = () => ({
    ...SEMANTIC_CATALOG,
    entities: Object.entries(QUERY_TABLES).map(([id, fields]) => ({id, fields: fields.map((field) => ({
        id: field, sensitivity: ['first_name', 'last_name', 'customer_number', 'city', 'country', 'shipping_city', 'shipping_country'].includes(field)
            ? 'synthetic-personal' : ['description', 'reason', 'subject'].includes(field) ? 'untrusted-text' : 'synthetic-operational'
    }))})),
    metrics: Object.values(SEMANTIC_METRICS).map((metric) => ({
        ...metric, formula: metric.expression,
        exclusions: [...metric.excludedOrderStatuses?.map((status) => `orders.status != ${status}`) ?? [], ...metric.fixedPredicates ?? []],
        validTimeFields: metric.timeScope.kind === 'period' ? [metric.timeScope.field] : [],
        allowedDimensions: metric.compatibleDimensions, synonyms: synonyms[metric.id], sensitivity: 'synthetic-aggregate',
        display: {format: metric.unit === 'EUR' ? 'currency' : 'number', decimals: metric.unit === 'EUR' ? 2 : 0}
    })),
    dimensions: Object.values(SEMANTIC_DIMENSIONS).map((dimension) => ({...dimension, enums: dimension.filterValues ?? [],
        display: {format: dimension.id === 'month' ? 'date' : 'text'}, sensitivity: 'synthetic-category'}))
});

export const semanticCatalogGuide = (): string => semanticCatalogMetadata().metrics.map((metric) =>
    `${metric.id}: ${metric.description} Grain=${metric.grain}; unit=${metric.unit}; dimensions=${metric.allowedDimensions.join(',')}; time=${metric.validTimeFields.join(',') || 'lifetime'}; exclusions=${metric.exclusions.join(';') || 'none'}.`).join('\n');

export const semanticCatalogMarkdown = (): string => ['# Semantic catalog v3',
    'Generated from the server-owned catalog. All data is synthetic. Refund periods use request time, not payment time.',
    ...semanticCatalogMetadata().metrics.map((metric) => `\n## ${metric.label}\n\n${metric.description}\n\nFormula: ${metric.formula}. Grain: ${metric.grain}; unit: ${metric.unit}.\n\nTime fields: ${metric.validTimeFields.join(', ') || 'lifetime'}. Dimensions: ${metric.allowedDimensions.join(', ')}.\n\nExclusions: ${metric.exclusions.join('; ') || 'none'}.`)
].join('\n\n');
