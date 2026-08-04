import {z} from 'zod';
import {
    SEMANTIC_DIMENSION_IDS,
    SEMANTIC_METRIC_IDS,
    semanticFilterSchema,
    semanticOrderSchema,
    semanticTimeRangeSchema
} from '../data/semantic/index.ts';

export const REGIONS = ['Central', 'East', 'North', 'South', 'West'] as const;
export const ORDER_STATUSES = ['cancelled', 'delayed', 'delivered', 'processing', 'returned', 'shipped'] as const;
export const PRODUCT_CATEGORIES = [
    'Laptops',
    'Monitors',
    'Audio',
    'Keyboards',
    'Mice',
    'Mobile',
    'Tablets',
    'Storage',
    'Networking',
    'Office'
] as const;

const nullableString = z.string().nullable();
const nullableNumber = z.number().nullable();
const nullableRegion = z.enum(REGIONS).nullable();

export const dashboardArguments = z.object({
    from: nullableString,
    to: nullableString,
    region: nullableRegion,
    group_by: z.enum(['month', 'category', 'region'])
}).strict();

export const queryDatasetArguments = z.object({
    sql: z.string().trim().min(1).max(6_000),
    title: z.string().trim().min(1).max(120),
    presentation: z.enum(['auto', 'metric', 'table', 'bar', 'line'])
}).strict();

export const semanticQueryArguments = z.object({
    plan: z.object({
        metric: z.enum(SEMANTIC_METRIC_IDS),
        dimensions: z.array(z.enum(SEMANTIC_DIMENSION_IDS)).max(3),
        filters: z.array(semanticFilterSchema).max(4),
        timeRange: semanticTimeRangeSchema.nullable(),
        orderBy: semanticOrderSchema.nullable(),
        limit: z.number().int().min(1).max(100).nullable()
    }).strict(),
    title: z.string().trim().min(1).max(120),
    presentation: z.enum(['auto', 'metric', 'table', 'bar', 'line']).optional()
}).strict();

export const ordersArguments = z.object({
    search: nullableString,
    statuses: z.array(z.enum(ORDER_STATUSES)).max(6),
    region: nullableRegion,
    minimum_total_eur: nullableNumber,
    maximum_total_eur: nullableNumber,
    from: nullableString,
    to: nullableString,
    sort: z.enum(['created_asc', 'created_desc', 'total_asc', 'total_desc']),
    limit: z.number().int().min(1).max(25)
}).strict();

export const productsArguments = z.object({
    query: nullableString,
    category: z.enum(PRODUCT_CATEGORIES).nullable(),
    brands: z.array(z.string()).max(10),
    skus: z.array(z.string()).max(20),
    minimum_price_eur: nullableNumber,
    maximum_price_eur: nullableNumber,
    minimum_rating: nullableNumber,
    minimum_stock: nullableNumber,
    maximum_stock: nullableNumber,
    in_stock_only: z.boolean(),
    preferences: z.array(z.string()).max(10),
    attribute_filters: z.array(z.object({
        key: z.string(),
        value: z.union([z.string(), z.number(), z.boolean()])
    }).strict()).max(10),
    limit: z.number().int().min(1).max(20)
}).strict();

export const orderArguments = z.object({order_number: z.string().min(1)}).strict();
export const policyArguments = z.object({query: z.string().min(2), limit: z.number().int().min(1).max(8)}).strict();

export const detailsArguments = z.object({
    kind: z.enum(['order_lookup', 'return_request', 'cancellation', 'shipping_address', 'product_preferences']),
    order_number: nullableString
}).strict();

export const actionArguments = z.object({
    action_type: z.enum(['return_order', 'update_shipping_address', 'cancel_order']),
    order_number: z.string().min(1),
    reason: nullableString,
    address: z.object({
        line1: z.string(),
        city: z.string(),
        postal_code: z.string(),
        country: z.string()
    }).strict().nullable()
}).strict();
