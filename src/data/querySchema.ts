import {DATASET_REFERENCE_DATE} from './constants.ts';

export const QUERY_TABLES = {
    customers: [
        'id', 'customer_number', 'first_name', 'last_name', 'region', 'city', 'country', 'tier', 'joined_at'
    ],
    products: [
        'id', 'sku', 'name', 'description', 'category', 'brand', 'price_cents', 'stock_quantity', 'rating', 'active'
    ],
    orders: [
        'id', 'order_number', 'customer_id', 'status', 'region', 'subtotal_cents', 'discount_cents',
        'shipping_cents', 'tax_cents', 'total_cents', 'currency', 'shipping_city', 'shipping_country',
        'created_at', 'updated_at'
    ],
    order_items: ['id', 'order_id', 'product_id', 'quantity', 'unit_price_cents', 'line_total_cents'],
    payments: ['id', 'order_id', 'method', 'status', 'amount_cents', 'paid_at'],
    shipments: [
        'id', 'order_id', 'carrier', 'status', 'shipped_at', 'expected_delivery_at', 'delivered_at'
    ],
    returns: ['id', 'return_number', 'order_id', 'status', 'reason', 'requested_at', 'refund_cents'],
    support_cases: [
        'id', 'case_number', 'customer_id', 'order_id', 'subject', 'category', 'priority', 'status',
        'created_at', 'updated_at'
    ]
} as const;

export type QueryTableName = keyof typeof QUERY_TABLES;

export const QUERY_RELATIONSHIPS = [
    ['orders.customer_id', 'customers.id'],
    ['order_items.order_id', 'orders.id'],
    ['order_items.product_id', 'products.id'],
    ['payments.order_id', 'orders.id'],
    ['shipments.order_id', 'orders.id'],
    ['returns.order_id', 'orders.id'],
    ['support_cases.customer_id', 'customers.id'],
    ['support_cases.order_id', 'orders.id']
] as const;

export const QUERY_FUNCTIONS = [
    'abs', 'avg', 'coalesce', 'count', 'date', 'datetime', 'ifnull', 'julianday', 'length',
    'lower', 'ltrim', 'max', 'min', 'nullif', 'round', 'rtrim', 'strftime', 'substr', 'sum',
    'time', 'total', 'trim', 'unixepoch', 'upper'
] as const;

export const HIDDEN_QUERY_COLUMNS = [
    'attributes_json', 'body', 'details_json', 'email', 'payload_json', 'phone', 'shipping_line1',
    'shipping_postal_code', 'source_path', 'tracking_number'
] as const;

export const DATASET_QUERY_GUIDE = `Query the synthetic retail dataset when the user asks for a data fact that the specialized tools do not answer, especially customer counts, customer segments, custom aggregates, and cross-table analysis.

Dataset snapshot: ${DATASET_REFERENCE_DATE}. Interpret "now", "current", and relative periods against that timestamp. Expected-delivery dates may be later because they are forecasts. For observed events, exclude event timestamps later than the snapshot.

SQLite schema exposed to this tool:
- customers(id PK, customer_number, first_name, last_name, region, city, country, tier, joined_at)
- products(id PK, sku, name, description, category, brand, price_cents, stock_quantity, rating, active)
- orders(id PK, order_number, customer_id FK customers.id, status, region, subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents, currency, shipping_city, shipping_country, created_at, updated_at)
- order_items(id PK, order_id FK orders.id, product_id FK products.id, quantity, unit_price_cents, line_total_cents)
- payments(id PK, order_id FK orders.id, method, status, amount_cents, paid_at)
- shipments(id PK, order_id FK orders.id, carrier, status, shipped_at, expected_delivery_at, delivered_at)
- returns(id PK, return_number, order_id FK orders.id, status, reason, requested_at, refund_cents)
- support_cases(id PK, case_number, customer_id FK customers.id, order_id FK orders.id nullable, subject, category, priority, status, created_at, updated_at)

Semantic rules:
- "Customers" means rows in customers. "Active customers" means COUNT(DISTINCT orders.customer_id) over an explicit period.
- Revenue uses orders.total_cents and excludes cancelled and returned orders unless the user asks otherwise.
- When joining order_items, use COUNT(DISTINCT orders.id) for order counts. line_total_cents is merchandise value before order-level discount, tax, and shipping.
- All *_cents fields are integer EUR cents. Divide by 100.0, ROUND to 2 decimals, and alias the result with an _eur suffix.
- Use orders.created_at for sales periods and customers.joined_at for acquisition periods. Timestamps are ISO 8601 UTC text.

SQL contract:
- Produce exactly one read-only SQLite SELECT. Non-recursive CTEs are allowed; compound SELECTs are not.
- Use only the published tables, relationship joins, and these functions: ${QUERY_FUNCTIONS.join(', ')}.
- Never use SELECT *, table.*, schema-qualified names, comments, parameters, table-valued functions, or hidden/internal tables.
- Give every computed column a short, descriptive snake_case alias. For a metric use customer_count or another semantic name, never generic value. For bar/line charts, return exactly two columns: alias the category label and give the numeric column a semantic alias such as customer_count or revenue_eur. Sort/top-N in SQL and keep at most 24 points.
- Keep detailed tables narrow and bounded. The server returns at most 100 rows and 12 columns.

The server parses and canonicalizes the SELECT, validates every source/function/join, executes it in an isolated read-only worker, and renders the result. If the tool returns a policy or syntax error, correct the query once using this published schema.`;
