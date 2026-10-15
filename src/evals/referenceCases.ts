import {DATASET_REFERENCE_DATE} from '../data/constants.ts';
import type {EvaluationScenario} from './scenario.ts';

export const referenceArguments = (scenario: EvaluationScenario, tool: string): Record<string, unknown> =>
{
    const id = scenario.id;
    if (tool === 'get_dashboard') return {from: '2026-01-01', to: '2026-06-30', region: null,
        group_by: id.includes('region') ? 'region' : id.includes('category') ? 'category' : 'month'};
    if (tool === 'get_order') return {order_number: id.includes('address') || id === 'action-cancel-prepare' ? 'ORD-1176' : 'ORD-1042'};
    if (tool === 'list_orders') return {search: null, statuses: [id.includes('returned') ? 'returned' : id.includes('delivered') ? 'delivered' : 'delayed'],
        region: id.includes('east') ? 'East' : null, minimum_total_eur: id.includes('high-value') || id.includes('bulk') ? 500 : null,
        maximum_total_eur: null, from: null, to: null, sort: id.includes('high-value') ? 'total_desc' : 'created_desc',
        limit: id.includes('recent') ? 10 : 25};
    if (tool === 'search_products') return {query: null,
        category: id.includes('laptop') ? 'Laptops' : id.includes('monitor') ? 'Monitors' : id.includes('audio') ? 'Audio' : null,
        brands: [], skus: id.includes('compare') ? ['SKU-0001', 'SKU-0002'] : [], minimum_price_eur: null,
        maximum_price_eur: id.includes('budget') ? 1200 : id.includes('travel') ? 1500 : null, minimum_rating: null,
        minimum_stock: id.includes('low-stock') ? 1 : null, maximum_stock: id.includes('low-stock') ? 4 : null,
        in_stock_only: true, preferences: [], attribute_filters: id.includes('audio')
            ? [{key: 'wireless', value: true}, {key: 'noiseCancelling', value: true}] : [], limit: id.includes('travel') ? 3 : 5};
    if (tool === 'request_details') return {kind: id.includes('order') ? 'order_lookup' : 'product_preferences', order_number: null};
    if (tool === 'search_policies') return {query: id.includes('return') || id.includes('refund') ? 'return window refund timing'
        : id.includes('laptop') ? 'laptop travel development specifications' : 'shipping address delay escalation', limit: 3};
    if (tool === 'prepare_action') return {action_type: id.includes('address') ? 'update_shipping_address'
        : id.includes('cancel') ? 'cancel_order' : 'return_order', order_number: id.includes('return') ? 'ORD-1042' : 'ORD-1176',
        reason: 'Performance did not meet expectations', address: id.includes('address')
            ? {line1: '10 Demo Avenue', city: 'Bucharest', postal_code: '010101', country: 'Romania'} : null};
    if (tool === 'query_dataset')
    {
        let sql = 'SELECT COUNT(*) AS customer_count FROM customers';
        let presentation = 'metric';
        if (id.includes('customers-by-tier'))
        {
            sql = 'SELECT tier, COUNT(*) AS customer_count FROM customers GROUP BY tier ORDER BY customer_count DESC';
            presentation = 'bar';
        }
        if (id.includes('revenue-by-customer-tier'))
        {
            sql = `SELECT c.tier, ROUND(SUM(o.total_cents) / 100.0, 2) AS revenue_eur
                FROM orders o JOIN customers c ON c.id = o.customer_id
                WHERE o.created_at >= '2026-01-01' AND o.created_at <= '${DATASET_REFERENCE_DATE}'
                AND o.status NOT IN ('cancelled', 'returned') GROUP BY c.tier ORDER BY revenue_eur DESC`;
            presentation = 'bar';
        }
        if (id.includes('latest-gold'))
        {
            sql = "SELECT MAX(joined_at) AS joined_at FROM customers WHERE tier = 'gold'";
            presentation = 'auto';
        }
        if (id.includes('latest-customers'))
        {
            sql = 'SELECT customer_number,first_name,last_name,tier,joined_at FROM customers ORDER BY joined_at DESC,id ASC LIMIT 5';
            presentation = 'table';
        }
        return {sql, title: 'Synthetic snapshot result', presentation};
    }
    throw new Error(`No deterministic reference call for ${scenario.id}/${tool}`);
};

export const referenceAnnotation = (id: string): string => id === 'analytics-customer-count'
    ? 'The synthetic dataset has 200 customers.' : id.includes('latest-gold')
        ? 'The latest gold registration was 14 Dec 2025, 12:00 UTC.'
        : id === 'policy-return-window' ? 'Eligible items can be returned within 30 calendar days.'
            : id === 'policy-refund-timing' ? 'Refunds take 5 to 7 business days after receipt.'
                : 'Here is the result from the synthetic snapshot.';
