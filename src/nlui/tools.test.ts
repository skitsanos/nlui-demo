import {describe, expect, test} from 'bun:test';
import {executeNluiTool} from './tools.ts';

describe('NLUI tool catalog', () =>
{
    test('turns dashboard data into trusted metrics and a chart', async () =>
    {
        const result = await executeNluiTool('get_dashboard', JSON.stringify({
            from: '2026-01-01',
            to: '2026-06-30',
            region: null,
            group_by: 'month'
        }));

        expect(result.blocks.map(({type}) => type)).toEqual(['stats', 'chart']);
        expect(result.blocks[1]).toMatchObject({type: 'chart', variant: 'line'});
    });

    test('renders a schema-aware customer count as one trusted metric', async () =>
    {
        const result = await executeNluiTool('query_dataset', JSON.stringify({
            sql: 'SELECT COUNT(*) AS customer_count FROM customers',
            title: 'Registered customers',
            presentation: 'metric'
        }));

        expect(result.modelOutput).toMatchObject({ok: true, rows: [{c0: 200}], renderedAs: 'metric'});
        expect(result.blocks[0]).toMatchObject({
            type: 'stats',
            title: 'Registered customers',
            items: [{label: 'Customer count', value: 200}]
        });
    });

    test('renders a two-column grouped query as a controlled chart', async () =>
    {
        const result = await executeNluiTool('query_dataset', JSON.stringify({
            sql: 'SELECT tier AS label, COUNT(*) AS value FROM customers GROUP BY tier ORDER BY value DESC',
            title: 'Customers by tier',
            presentation: 'bar'
        }));

        expect(result.blocks[0]).toMatchObject({
            type: 'chart',
            variant: 'bar',
            title: 'Customers by tier'
        });
    });

    test('returns a recoverable error instead of executing generated mutations', async () =>
    {
        const result = await executeNluiTool('query_dataset', JSON.stringify({
            sql: 'DELETE FROM customers',
            title: 'Unsafe query',
            presentation: 'auto'
        }));

        expect(result.blocks).toEqual([]);
        expect(result.modelOutput).toMatchObject({ok: false});
        expect(String((result.modelOutput as {error: string}).error)).toStartWith('SQL_POLICY:');
    });

    test('keeps order filtering in the repository and returns a table', async () =>
    {
        const result = await executeNluiTool('list_orders', JSON.stringify({
            search: null,
            statuses: ['delayed'],
            region: null,
            minimum_total_eur: 500,
            maximum_total_eur: null,
            from: null,
            to: null,
            sort: 'total_desc',
            limit: 20
        }));

        const table = result.blocks[0];
        expect(table?.type).toBe('table');
        if (table?.type === 'table')
        {
            expect(table.rows.length).toBeGreaterThan(0);
            expect(table.rows.every((row) => row.status === 'delayed' && Number(row.total) >= 500)).toBeTrue();
        }
    });

    test('renders bounded product choices from exact query results', async () =>
    {
        const result = await executeNluiTool('search_products', JSON.stringify({
            query: 'laptop',
            category: 'Laptops',
            brands: [],
            skus: [],
            minimum_price_eur: null,
            maximum_price_eur: 1_200,
            minimum_rating: null,
            minimum_stock: null,
            maximum_stock: null,
            in_stock_only: true,
            preferences: ['creative work'],
            attribute_filters: [],
            limit: 5
        }));

        const choices = result.blocks[0];
        expect(choices?.type).toBe('choices');
        if (choices?.type === 'choices')
        {
            expect(choices.options.length).toBeLessThanOrEqual(5);
            expect(new Set(choices.options.map(({value}) => value)).size).toBe(choices.options.length);
        }
    });

    test('renders exact SKU follow-ups as details instead of another choice', async () =>
    {
        const result = await executeNluiTool('search_products', JSON.stringify({
            query: null,
            category: null,
            brands: [],
            skus: ['SKU-0007'],
            minimum_price_eur: null,
            maximum_price_eur: null,
            minimum_rating: null,
            minimum_stock: null,
            maximum_stock: null,
            in_stock_only: true,
            preferences: [],
            attribute_filters: [],
            limit: 1
        }));

        expect(result.blocks[0]).toMatchObject({type: 'stats', title: 'Northstar Pro 7'});
    });

    test('gives repeated forms unique interaction identifiers', async () =>
    {
        const first = await executeNluiTool('request_details', JSON.stringify({
            kind: 'return_request',
            order_number: null
        }));
        const second = await executeNluiTool('request_details', JSON.stringify({
            kind: 'return_request',
            order_number: null
        }));
        const firstBlock = first.blocks[0];
        const secondBlock = second.blocks[0];

        expect(firstBlock?.type).toBe('form');
        expect(secondBlock?.type).toBe('form');
        if (firstBlock?.type === 'form' && secondBlock?.type === 'form')
        {
            expect(firstBlock.interactionId).not.toBe(secondBlock.interactionId);
        }
    });

    test('turns domain validation errors into recoverable model output', async () =>
    {
        const result = await executeNluiTool('get_order', JSON.stringify({order_number: 'ORD-99999'}));
        expect(result.blocks).toEqual([]);
        expect(result.modelOutput).toEqual({found: false, orderNumber: 'ORD-99999'});
    });
});
