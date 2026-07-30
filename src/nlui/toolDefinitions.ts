import type {FunctionTool} from 'openai/resources/responses/responses';
import {DATASET_QUERY_GUIDE} from '../data/querySchema.ts';
import {ORDER_STATUSES, PRODUCT_CATEGORIES, REGIONS} from './toolArguments.ts';

const objectSchema = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({
    type: 'object',
    properties,
    required,
    additionalProperties: false
});

const nullable = (type: 'string' | 'number') => ({type: [type, 'null']});
const stringArray = {type: 'array', items: {type: 'string'}};

export const OPENAI_TOOLS: FunctionTool[] = [
    {
        type: 'function',
        name: 'get_dashboard',
        description: 'Get exact revenue, order, support, and sales-series metrics for a date range and optional region. Use for trends, comparisons, KPIs, and charts.',
        strict: true,
        parameters: objectSchema({
            from: nullable('string'),
            to: nullable('string'),
            region: {type: ['string', 'null'], enum: [...REGIONS, null]},
            group_by: {type: 'string', enum: ['month', 'category', 'region']}
        })
    },
    {
        type: 'function',
        name: 'query_dataset',
        description: DATASET_QUERY_GUIDE,
        strict: true,
        parameters: objectSchema({
            sql: {
                type: 'string',
                minLength: 1,
                maxLength: 6_000,
                description: 'One bounded SQLite SELECT using only the published schema and SQL contract.'
            },
            title: {
                type: 'string',
                minLength: 1,
                maxLength: 120,
                description: 'A concise user-facing title for the verified result.'
            },
            presentation: {
                type: 'string',
                enum: ['auto', 'metric', 'table', 'bar', 'line'],
                description: 'Preferred controlled renderer. The server falls back when the result shape is incompatible.'
            }
        })
    },
    {
        type: 'function',
        name: 'list_orders',
        description: 'Find and filter synthetic commerce orders. Use for delayed, high-value, regional, dated, customer, or status-based order lists.',
        strict: true,
        parameters: objectSchema({
            search: nullable('string'),
            statuses: {type: 'array', items: {type: 'string', enum: ORDER_STATUSES}},
            region: {type: ['string', 'null'], enum: [...REGIONS, null]},
            minimum_total_eur: nullable('number'),
            maximum_total_eur: nullable('number'),
            from: nullable('string'),
            to: nullable('string'),
            sort: {type: 'string', enum: ['created_asc', 'created_desc', 'total_asc', 'total_desc']},
            limit: {type: 'integer', minimum: 1, maximum: 25}
        })
    },
    {
        type: 'function',
        name: 'search_products',
        description: 'Search the synthetic product catalog and return interactive product choices. Use query for product words, an exact catalog category for hard category constraints, preferences for soft use-case ranking, and attribute_filters only for exact attribute values. Only set brands, rating, price, or stock limits when the user explicitly requests them.',
        strict: true,
        parameters: objectSchema({
            query: nullable('string'),
            category: {type: ['string', 'null'], enum: [...PRODUCT_CATEGORIES, null]},
            brands: stringArray,
            skus: stringArray,
            minimum_price_eur: nullable('number'),
            maximum_price_eur: nullable('number'),
            minimum_rating: nullable('number'),
            minimum_stock: nullable('number'),
            maximum_stock: nullable('number'),
            in_stock_only: {type: 'boolean'},
            preferences: stringArray,
            attribute_filters: {
                type: 'array',
                items: objectSchema({
                    key: {type: 'string'},
                    value: {type: ['string', 'number', 'boolean']}
                })
            },
            limit: {type: 'integer', minimum: 1, maximum: 20}
        })
    },
    {
        type: 'function',
        name: 'get_order',
        description: 'Look up one order by an order number such as ORD-1042 and return its status, totals, shipment, and line items. Do not zero-pad the numeric part.',
        strict: true,
        parameters: objectSchema({order_number: {type: 'string'}})
    },
    {
        type: 'function',
        name: 'search_policies',
        description: 'Search the application-owned policy documents for returns, shipping, warranties, payments, privacy, or support guidance.',
        strict: true,
        parameters: objectSchema({
            query: {type: 'string'},
            limit: {type: 'integer', minimum: 1, maximum: 8}
        })
    },
    {
        type: 'function',
        name: 'request_details',
        description: 'Render an application-owned form when required information is missing for an order lookup, return, cancellation, address change, or product recommendation.',
        strict: true,
        parameters: objectSchema({
            kind: {type: 'string', enum: ['order_lookup', 'return_request', 'cancellation', 'shipping_address', 'product_preferences']},
            order_number: nullable('string')
        })
    },
    {
        type: 'function',
        name: 'prepare_action',
        description: 'Validate and prepare a return, cancellation, or address update. This does not mutate data; it returns an opaque confirmation action for the user.',
        strict: true,
        parameters: objectSchema({
            action_type: {type: 'string', enum: ['return_order', 'update_shipping_address', 'cancel_order']},
            order_number: {type: 'string'},
            reason: nullable('string'),
            address: {
                anyOf: [
                    objectSchema({
                        line1: {type: 'string'},
                        city: {type: 'string'},
                        postal_code: {type: 'string'},
                        country: {type: 'string'}
                    }),
                    {type: 'null'}
                ]
            }
        })
    }
];
