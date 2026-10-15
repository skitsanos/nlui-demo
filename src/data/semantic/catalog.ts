export const SEMANTIC_CATALOG_VERSION = 3;
export const SEMANTIC_CATALOG_ID = 'retail-operations';

export const SEMANTIC_METRIC_IDS = [
    'registered_customer_count',
    'customer_registrations',
    'active_customer_count',
    'eligible_order_count',
    'eligible_revenue_eur',
    'average_order_value_eur',
    'merchandise_revenue_eur',
    'completed_refunds_eur'
] as const;

export const SEMANTIC_DIMENSION_IDS = [
    'month',
    'region',
    'customer_tier',
    'order_status',
    'product_category'
] as const;

export const CUSTOMER_REGIONS = ['Central', 'East', 'North', 'South', 'West'] as const;
export const CUSTOMER_TIERS = ['standard', 'silver', 'gold'] as const;
export const ORDER_STATUSES = [
    'cancelled',
    'delayed',
    'delivered',
    'processing',
    'returned',
    'shipped'
] as const;

export type SemanticMetricId = typeof SEMANTIC_METRIC_IDS[number];
export type SemanticDimensionId = typeof SEMANTIC_DIMENSION_IDS[number];
export type SemanticEntity = 'customers' | 'orders' | 'order_items' | 'returns' | 'products';
export type SemanticRelationshipId = 'orders_customer' | 'items_order' | 'items_product' | 'returns_order';
export type SemanticUnit = 'count' | 'EUR';

export type SemanticTimeScope =
    | {kind: 'lifetime'}
    | {kind: 'period'; requirement: 'required' | 'optional'; field: string};

export interface SemanticMetricDefinition
{
    id: SemanticMetricId;
    label: string;
    description: string;
    baseEntity: SemanticEntity;
    expression: string;
    unit: SemanticUnit;
    grain: 'customer' | 'order' | 'order_item' | 'return';
    timeScope: SemanticTimeScope;
    compatibleDimensions: readonly SemanticDimensionId[];
    excludedOrderStatuses?: readonly typeof ORDER_STATUSES[number][];
    requiredRelationships?: readonly SemanticRelationshipId[];
    fixedPredicates?: readonly string[];
}

interface DimensionSource
{
    expression: string;
    relationship?: SemanticRelationshipId;
}

interface SemanticDimensionDefinition
{
    id: SemanticDimensionId;
    label: string;
    description: string;
    sources: Partial<Record<SemanticEntity, DimensionSource>>;
    filterValues?: readonly string[];
}

interface SemanticRelationshipDefinition
{
    id: SemanticRelationshipId;
    fromEntity: SemanticEntity;
    toEntity: SemanticEntity;
    fromField: string;
    toField: string;
    joinSql: string;
}

const lifetimeCustomerDimensions = ['region', 'customer_tier'] as const;
const registrationDimensions = ['month', 'region', 'customer_tier'] as const;
const orderDimensions = ['month', 'region', 'customer_tier', 'order_status'] as const;
const excludedOrderStatuses = ['cancelled', 'returned'] as const;

export const SEMANTIC_METRICS: Readonly<Record<SemanticMetricId, SemanticMetricDefinition>> = {
    registered_customer_count: {
        id: 'registered_customer_count',
        label: 'Registered customers',
        description: 'Distinct customer records across the complete observed dataset.',
        baseEntity: 'customers',
        expression: 'COUNT(DISTINCT customers.id)',
        unit: 'count',
        grain: 'customer',
        timeScope: {kind: 'lifetime'},
        compatibleDimensions: lifetimeCustomerDimensions
    },
    customer_registrations: {
        id: 'customer_registrations',
        label: 'Customer registrations',
        description: 'Distinct customers registered during an explicit acquisition period.',
        baseEntity: 'customers',
        expression: 'COUNT(DISTINCT customers.id)',
        unit: 'count',
        grain: 'customer',
        timeScope: {kind: 'period', requirement: 'required', field: 'customers.joined_at'},
        compatibleDimensions: registrationDimensions
    },
    active_customer_count: {
        id: 'active_customer_count',
        label: 'Active customers',
        description: 'Distinct customers with at least one order in an explicit order period.',
        baseEntity: 'orders',
        expression: 'COUNT(DISTINCT orders.customer_id)',
        unit: 'count',
        grain: 'customer',
        timeScope: {kind: 'period', requirement: 'required', field: 'orders.created_at'},
        compatibleDimensions: orderDimensions
    },
    eligible_order_count: {
        id: 'eligible_order_count',
        label: 'Eligible orders',
        description: 'Distinct orders excluding cancelled and returned orders.',
        baseEntity: 'orders',
        expression: 'COUNT(DISTINCT orders.id)',
        unit: 'count',
        grain: 'order',
        timeScope: {kind: 'period', requirement: 'optional', field: 'orders.created_at'},
        compatibleDimensions: orderDimensions,
        excludedOrderStatuses
    },
    eligible_revenue_eur: {
        id: 'eligible_revenue_eur',
        label: 'Eligible revenue',
        description: 'Order total revenue in EUR excluding cancelled and returned orders.',
        baseEntity: 'orders',
        expression: 'ROUND(COALESCE(SUM(orders.total_cents), 0) / 100.0, 2)',
        unit: 'EUR',
        grain: 'order',
        timeScope: {kind: 'period', requirement: 'optional', field: 'orders.created_at'},
        compatibleDimensions: orderDimensions,
        excludedOrderStatuses
    },
    average_order_value_eur: {
        id: 'average_order_value_eur',
        label: 'Average order value',
        description: 'Average order total in EUR excluding cancelled and returned orders.',
        baseEntity: 'orders',
        expression: 'ROUND(COALESCE(AVG(orders.total_cents), 0) / 100.0, 2)',
        unit: 'EUR',
        grain: 'order',
        timeScope: {kind: 'period', requirement: 'optional', field: 'orders.created_at'},
        compatibleDimensions: orderDimensions,
        excludedOrderStatuses
    },
    merchandise_revenue_eur: {
        id: 'merchandise_revenue_eur', label: 'Merchandise revenue',
        description: 'Gross line merchandise value in EUR before order discount, tax and shipping; excludes cancelled and returned orders.',
        baseEntity: 'order_items', expression: 'ROUND(COALESCE(SUM(order_items.line_total_cents), 0) / 100.0, 2)',
        unit: 'EUR', grain: 'order_item', timeScope: {kind: 'period', requirement: 'optional', field: 'orders.created_at'},
        compatibleDimensions: [...orderDimensions, 'product_category'], excludedOrderStatuses, requiredRelationships: ['items_order']
    },
    completed_refunds_eur: {
        id: 'completed_refunds_eur', label: 'Completed refunds',
        description: 'Refund EUR on completed return records, dated by return request (not refund payment date, which is unavailable). Pending/approved/received returns are excluded.',
        baseEntity: 'returns', expression: 'ROUND(COALESCE(SUM(returns.refund_cents), 0) / 100.0, 2)',
        unit: 'EUR', grain: 'return', timeScope: {kind: 'period', requirement: 'optional', field: 'returns.requested_at'},
        compatibleDimensions: orderDimensions, requiredRelationships: ['returns_order'], fixedPredicates: ["returns.status = 'completed'"]
    }
};

export const SEMANTIC_DIMENSIONS: Readonly<Record<SemanticDimensionId, SemanticDimensionDefinition>> = {
    month: {
        id: 'month',
        label: 'Month',
        description: 'Calendar month on the metric-specific event time field.',
        sources: {
            customers: {expression: "strftime('%Y-%m', customers.joined_at)"},
            orders: {expression: "strftime('%Y-%m', orders.created_at)"},
            order_items: {expression: "strftime('%Y-%m', orders.created_at)"},
            returns: {expression: "strftime('%Y-%m', returns.requested_at)"}
        }
    },
    region: {
        id: 'region',
        label: 'Region',
        description: 'Customer acquisition region or order region, according to the metric grain.',
        sources: {
            customers: {expression: 'customers.region'},
            orders: {expression: 'orders.region'},
            order_items: {expression: 'orders.region'}, returns: {expression: 'orders.region'}
        },
        filterValues: CUSTOMER_REGIONS
    },
    customer_tier: {
        id: 'customer_tier',
        label: 'Customer tier',
        description: 'Customer membership tier.',
        sources: {
            customers: {expression: 'customers.tier'},
            orders: {expression: 'customers.tier', relationship: 'orders_customer'},
            order_items: {expression: 'customers.tier', relationship: 'orders_customer'},
            returns: {expression: 'customers.tier', relationship: 'orders_customer'}
        },
        filterValues: CUSTOMER_TIERS
    },
    order_status: {
        id: 'order_status',
        label: 'Order status',
        description: 'Current order lifecycle status.',
        sources: {orders: {expression: 'orders.status'}, order_items: {expression: 'orders.status'}, returns: {expression: 'orders.status'}},
        filterValues: ORDER_STATUSES
    },
    product_category: {
        id: 'product_category', label: 'Product category', description: 'Catalog merchandise category at line-item grain.',
        sources: {order_items: {expression: 'products.category', relationship: 'items_product'}},
        filterValues: ['Laptops', 'Monitors', 'Audio', 'Keyboards', 'Mice', 'Mobile', 'Tablets', 'Storage', 'Networking', 'Office']
    }
};

export const SEMANTIC_RELATIONSHIPS: Readonly<Record<SemanticRelationshipId, SemanticRelationshipDefinition>> = {
    orders_customer: {
        id: 'orders_customer',
        fromEntity: 'orders',
        toEntity: 'customers',
        fromField: 'orders.customer_id',
        toField: 'customers.id',
        joinSql: 'JOIN customers ON customers.id = orders.customer_id'
    },
    items_order: {id: 'items_order', fromEntity: 'order_items', toEntity: 'orders', fromField: 'order_items.order_id', toField: 'orders.id', joinSql: 'JOIN orders ON orders.id = order_items.order_id'},
    items_product: {id: 'items_product', fromEntity: 'order_items', toEntity: 'products', fromField: 'order_items.product_id', toField: 'products.id', joinSql: 'JOIN products ON products.id = order_items.product_id'},
    returns_order: {id: 'returns_order', fromEntity: 'returns', toEntity: 'orders', fromField: 'returns.order_id', toField: 'orders.id', joinSql: 'JOIN orders ON orders.id = returns.order_id'}
};

export const SEMANTIC_CATALOG = {
    id: SEMANTIC_CATALOG_ID,
    version: SEMANTIC_CATALOG_VERSION,
    metrics: SEMANTIC_METRICS,
    dimensions: SEMANTIC_DIMENSIONS,
    relationships: SEMANTIC_RELATIONSHIPS
} as const;
