import {describe, expect, test} from 'bun:test';
import {executeNluiTool, NLUI_TOOL_BLOCK_TYPES, OPENAI_TOOLS} from './tools.ts';

describe('NLUI tool catalog', () =>
{
    test('keeps provider definitions aligned with the runtime tool registry', () =>
    {
        expect(OPENAI_TOOLS.map(({name}) => name).sort()).toEqual(Object.keys(NLUI_TOOL_BLOCK_TYPES).sort());
    });

    test('turns dashboard data into trusted metrics and a chart', async () =>
    {
        const result = await executeNluiTool('get_dashboard', JSON.stringify({
            from: '2026-01-01',
            to: '2026-06-30',
            region: null,
            group_by: 'month'
        }));

        expect(result.blocks.map(({type}) => type)).toEqual(['stats', 'chart']);
        expect(result.blocks[1]).toMatchObject({type: 'chart', variant: 'line', categoryFormat: 'date'});
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
        expect(result.blocks[0]).not.toHaveProperty('categoryFormat');
    });

    test('recognizes strict temporal chart values behind a neutral label alias', async () =>
    {
        const result = await executeNluiTool('query_dataset', JSON.stringify({
            sql: `SELECT strftime('%Y-%m', created_at) AS label, COUNT(*) AS value
                  FROM orders GROUP BY label ORDER BY label LIMIT 6`,
            title: 'Orders over time',
            presentation: 'line'
        }));

        expect(result.blocks[0]).toMatchObject({
            type: 'chart',
            variant: 'line',
            categoryFormat: 'date'
        });
        expect(result.blocks[0]?.type === 'chart' ? result.blocks[0].data[0] : undefined)
            .toEqual({label: '2025-01', value: 83});
    });

    test('removes a sort-only helper before choosing the chart renderer', async () =>
    {
        const result = await executeNluiTool('query_dataset', JSON.stringify({
            sql: `SELECT strftime('%Y-%m', created_at) AS label,
                         COUNT(*) AS value,
                         MIN(julianday(created_at)) AS julian_sort_key
                  FROM orders GROUP BY label ORDER BY julian_sort_key LIMIT 6`,
            title: 'Orders over time',
            presentation: 'line'
        }));

        expect(result.traceOutput).toMatchObject({
            columns: [{name: 'label'}, {name: 'value'}, {name: 'julian_sort_key'}]
        });
        expect(result.modelOutput).toMatchObject({columns: [{name: 'label'}, {name: 'value'}]});
        expect(result.blocks[0]).toMatchObject({
            type: 'chart',
            variant: 'line',
            categoryFormat: 'date'
        });
        if (result.blocks[0]?.type === 'chart')
        {
            expect(Object.keys(result.blocks[0].data[0] ?? {})).toEqual(['label', 'value']);
        }
    });

    test('keeps a mixed scalar result in prose without changing model data', async () =>
    {
        const result = await executeNluiTool('query_dataset', JSON.stringify({
            sql: `SELECT DATE(MAX(joined_at)) AS last_joined_date,
                         MAX(joined_at) AS last_joined_at,
                         MAX('not-a-date') AS invalid_at,
                         COUNT(*) AS lifetime
                  FROM customers WHERE tier = 'gold'`,
            title: 'Latest gold registrations',
            presentation: 'metric'
        }));

        expect(result.modelOutput).toMatchObject({
            rows: [{
                c0: '2025-12-14',
                c1: '2025-12-14T12:00:00.000Z',
                c2: 'not-a-date',
                c3: 20
            }]
        });
        expect(result.modelOutput).toMatchObject({renderedAs: 'text'});
        expect(result.blocks).toEqual([]);
    });

    test('keeps a scalar date in prose and never exposes its Unix helper as a metric', async () =>
    {
        const result = await executeNluiTool('query_dataset', JSON.stringify({
            sql: `SELECT ROUND(unixepoch(MAX(joined_at)) / 86400.0) AS last_gold_join_unix_days,
                         MAX(joined_at) AS last_gold_joined_at
                  FROM customers WHERE tier = 'gold'`,
            title: 'Latest gold-tier customer registration',
            presentation: 'metric'
        }));

        expect(result.traceOutput).toMatchObject({
            columns: [
                {name: 'last_gold_join_unix_days'},
                {name: 'last_gold_joined_at'}
            ],
            rows: [{c0: 20437, c1: '2025-12-14T12:00:00.000Z'}]
        });
        expect(result.modelOutput).toMatchObject({
            columns: [{key: 'c1', name: 'last_gold_joined_at'}],
            rows: [{c1: '2025-12-14T12:00:00.000Z'}],
            renderedAs: 'text'
        });
        expect(result.blocks).toEqual([]);
    });

    test('keeps mixed single-record facts in prose but honors an explicit table', async () =>
    {
        const args = {
            sql: `SELECT first_name, last_name, joined_at FROM customers
                  WHERE tier = 'gold' ORDER BY joined_at DESC LIMIT 1`,
            title: 'Latest gold-tier customer'
        };
        const prose = await executeNluiTool('query_dataset', JSON.stringify({...args, presentation: 'auto'}));
        expect(prose.modelOutput).toMatchObject({renderedAs: 'text'});
        expect(prose.blocks).toEqual([]);

        const table = await executeNluiTool('query_dataset', JSON.stringify({...args, presentation: 'table'}));
        expect(table.modelOutput).toMatchObject({renderedAs: 'table', dataLocation: 'trusted_ui_block'});
        expect(table.modelOutput).not.toHaveProperty('rows');
        expect(table.blocks[0]).toMatchObject({type: 'table'});
    });

    test('asks the model to repair a query containing only technical helpers', async () =>
    {
        const result = await executeNluiTool('query_dataset', JSON.stringify({
            sql: `SELECT unixepoch(MAX(joined_at)) AS unix_timestamp
                  FROM customers WHERE tier = 'gold'`,
            title: 'Latest gold-tier customer registration',
            presentation: 'metric'
        }));

        expect(result.modelOutput).toMatchObject({ok: false});
        expect(result.traceOutput).toMatchObject({rows: [{c0: 1765713600}]});
        expect(result.blocks).toEqual([]);
    });

    test('marks temporal columns in generic query tables while preserving raw rows', async () =>
    {
        const result = await executeNluiTool('query_dataset', JSON.stringify({
            sql: `SELECT customer_number, joined_at, unixepoch(joined_at) AS _sort FROM customers
                  WHERE tier = 'gold' ORDER BY _sort DESC LIMIT 2`,
            title: 'Recent gold registrations',
            presentation: 'table'
        }));

        const block = result.blocks[0];
        expect(block?.type).toBe('table');
        if (block?.type === 'table')
        {
            expect(block.columns.map(({label, format}) => ({label, format}))).toEqual([
                {label: 'Customer number', format: 'text'},
                {label: 'Joined at', format: 'date'}
            ]);
            expect(block.rows[0]).toMatchObject({c1: '2025-12-14T12:00:00.000Z'});
            expect(block.rows[0]).not.toHaveProperty('c2');
            expect(JSON.stringify(result.modelOutput)).not.toContain(String(block.rows[0]?.c0));
        }
        expect(result.modelOutput).toMatchObject({renderedAs: 'table', dataLocation: 'trusted_ui_block'});
        expect(result.modelOutput).not.toHaveProperty('rows');
        expect((result.traceOutput as {rows: Array<Record<string, unknown>>}).rows[0]).toHaveProperty('c2');
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
            expect(table.rows.every((row) => typeof row.expectedDeliveryAt === 'string')).toBeTrue();
            expect(JSON.stringify(result.modelOutput)).not.toContain(String(table.rows[0]?.order));
        }
        expect(result.modelOutput).not.toHaveProperty('orders');
        expect(result.traceOutput).toHaveProperty('orders');
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
