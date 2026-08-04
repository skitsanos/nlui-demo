import {Database} from 'bun:sqlite';
import {afterEach, describe, expect, test} from 'bun:test';
import {
    compileSemanticQuery,
    SEMANTIC_CATALOG,
    SEMANTIC_DIMENSION_IDS,
    SEMANTIC_METRIC_IDS,
    SEMANTIC_RELATIONSHIPS,
    semanticQuerySchema
} from './index.ts';

const databases: Database[] = [];

const fixtureDatabase = (): Database =>
{
    const database = new Database(':memory:');
    databases.push(database);
    database.exec(`
        CREATE TABLE customers (
            id INTEGER PRIMARY KEY,
            region TEXT NOT NULL,
            tier TEXT NOT NULL,
            joined_at TEXT NOT NULL
        ) STRICT;
        CREATE TABLE orders (
            id INTEGER PRIMARY KEY,
            customer_id INTEGER NOT NULL REFERENCES customers(id),
            status TEXT NOT NULL,
            region TEXT NOT NULL,
            total_cents INTEGER NOT NULL,
            created_at TEXT NOT NULL
        ) STRICT;
        INSERT INTO customers VALUES
            (1, 'West', 'gold', '2025-01-10T12:00:00.000Z'),
            (2, 'East', 'silver', '2025-02-10T12:00:00.000Z'),
            (3, 'East', 'standard', '2025-02-20T12:00:00.000Z'),
            (4, 'West', 'gold', '2026-01-01T12:00:00.000Z');
        INSERT INTO orders VALUES
            (1, 1, 'delivered', 'West', 10000, '2026-01-05T12:00:00.000Z'),
            (2, 1, 'cancelled', 'West', 5000, '2026-01-10T12:00:00.000Z'),
            (3, 2, 'shipped', 'East', 20000, '2026-01-15T12:00:00.000Z'),
            (4, 3, 'returned', 'East', 30000, '2026-02-01T12:00:00.000Z'),
            (5, 3, 'delayed', 'East', 40000, '2026-02-12T12:00:00.000Z');
    `);
    return database;
};

const execute = (database: Database, input: unknown): Array<Record<string, unknown>> =>
{
    const compiled = compileSemanticQuery(input);
    return database.query(compiled.sql).all(...compiled.parameters) as Array<Record<string, unknown>>;
};

afterEach(() =>
{
    for (const database of databases.splice(0)) database.close();
});

describe('semantic catalog', () =>
{
    test('publishes a versioned metric, dimension, and relationship contract', () =>
    {
        expect(SEMANTIC_CATALOG.id).toBe('retail-operations');
        expect(SEMANTIC_CATALOG.version).toBe(2);
        expect(Object.keys(SEMANTIC_CATALOG.metrics)).toEqual([...SEMANTIC_METRIC_IDS]);
        expect(Object.keys(SEMANTIC_CATALOG.dimensions)).toEqual([...SEMANTIC_DIMENSION_IDS]);
        expect(SEMANTIC_CATALOG.metrics.registered_customer_count.timeScope)
            .toEqual({kind: 'lifetime'});
        expect(SEMANTIC_CATALOG.metrics.customer_registrations.timeScope)
            .toEqual({kind: 'period', requirement: 'required', field: 'customers.joined_at'});
        expect(SEMANTIC_CATALOG.metrics.eligible_revenue_eur.timeScope)
            .toEqual({kind: 'period', requirement: 'optional', field: 'orders.created_at'});
        expect(SEMANTIC_RELATIONSHIPS.orders_customer).toMatchObject({
            fromField: 'orders.customer_id',
            toField: 'customers.id',
            joinSql: 'JOIN customers ON customers.id = orders.customer_id'
        });
    });
});

describe('semantic query validation', () =>
{
    const messagesFor = (input: unknown): string[] =>
    {
        const result = semanticQuerySchema.safeParse(input);
        expect(result.success).toBeFalse();
        return result.success ? [] : result.error.issues.map(({message}) => message);
    };

    test('rejects unknown input and incompatible dimensions', () =>
    {
        expect(messagesFor({metric: 'registered_customer_count', unexpected: true}).join(' '))
            .toContain('Unrecognized key');
        expect(messagesFor({
            metric: 'registered_customer_count',
            dimensions: ['order_status']
        })).toContain('order_status is incompatible with registered_customer_count');
    });

    test('enforces catalog-owned lifetime and required-period scopes', () =>
    {
        for (const timeRange of [
            {from: '2026-01-01', to: '2026-06-30'},
            {from: '2025-01-01', to: '2025-12-31'}
        ])
        {
            expect(messagesFor({metric: 'registered_customer_count', timeRange}))
                .toContain('registered_customer_count is a lifetime metric and does not accept a time range');
        }
        expect(messagesFor({metric: 'registered_customer_count', dimensions: ['month']}))
            .toContain('month is incompatible with registered_customer_count');
        expect(messagesFor({metric: 'customer_registrations'}))
            .toContain('customer_registrations requires an explicit time range');
        expect(messagesFor({metric: 'active_customer_count'}))
            .toContain('active_customer_count requires an explicit time range');
        for (const metric of ['customer_registrations', 'active_customer_count'] as const)
        {
            expect(semanticQuerySchema.safeParse({
                metric,
                timeRange: {from: '2026-01-01', to: '2026-01-31'}
            }).success).toBeTrue();
        }
        expect(semanticQuerySchema.safeParse({metric: 'eligible_order_count'}).success).toBeTrue();
    });

    test('rejects ambiguous grouping, ordering, filters, and dates', () =>
    {
        expect(messagesFor({
            metric: 'eligible_order_count',
            dimensions: ['region', 'region']
        }).join(' ')).toContain('Dimensions must be unique');
        expect(messagesFor({
            metric: 'eligible_order_count',
            orderBy: {field: 'region', direction: 'asc'}
        })).toContain('Ordering by a dimension requires grouping by that dimension');
        expect(messagesFor({
            metric: 'eligible_revenue_eur',
            filters: [{dimension: 'order_status', values: ['cancelled']}]
        })).toContain('eligible_revenue_eur excludes cancelled and returned orders by definition');
        expect(messagesFor({
            metric: 'registered_customer_count',
            timeRange: {from: '2025-02-30', to: '2025-03-01'}
        })).toContain('Expected a valid calendar date in YYYY-MM-DD format');
        expect(messagesFor({
            metric: 'eligible_revenue_eur',
            timeRange: {from: '2026-01-01', to: '2026-12-31'}
        }).join(' ')).toContain('cannot extend beyond the dataset snapshot');
    });
});

describe('semantic query compilation', () =>
{
    test('compiles a deterministic parameterized customer query', () =>
    {
        const compiled = compileSemanticQuery({
            metric: 'registered_customer_count',
            dimensions: ['region'],
            filters: [{dimension: 'customer_tier', values: ['gold']}],
            orderBy: {field: 'region', direction: 'asc'},
            limit: 10
        });

        expect(compiled.sql).toBe(`SELECT
    customers.region AS region,
    COUNT(DISTINCT customers.id) AS registered_customer_count
FROM customers
WHERE customers.tier = ?
GROUP BY customers.region
ORDER BY region ASC`);
        expect(compiled.parameters).toEqual(['gold']);
        expect(compiled.relationships).toEqual([]);
        expect(compiled.planHash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('uses only the approved relationship and eligible-order definition', () =>
    {
        const database = fixtureDatabase();
        const input = {
            metric: 'eligible_revenue_eur',
            dimensions: ['customer_tier'],
            orderBy: {field: 'metric', direction: 'desc'}
        };
        const compiled = compileSemanticQuery(input);

        expect(compiled.relationships).toEqual(['orders_customer']);
        expect(compiled.sql).toContain('JOIN customers ON customers.id = orders.customer_id');
        expect(compiled.sql).toContain('orders.status NOT IN (?, ?)');
        expect(compiled.parameters).toEqual(['cancelled', 'returned']);
        expect(execute(database, input)).toEqual([
            {customer_tier: 'standard', eligible_revenue_eur: 400},
            {customer_tier: 'silver', eligible_revenue_eur: 200},
            {customer_tier: 'gold', eligible_revenue_eur: 100}
        ]);
    });

    test('applies inclusive calendar periods to active-customer denotation', () =>
    {
        const database = fixtureDatabase();
        const input = {
            metric: 'active_customer_count',
            dimensions: ['month'],
            timeRange: {from: '2026-01-01', to: '2026-01-31'}
        };
        const compiled = compileSemanticQuery(input);

        expect(compiled.parameters).toEqual(['2026-01-01', '2026-01-31']);
        expect(execute(database, input)).toEqual([{month: '2026-01', active_customer_count: 2}]);
    });

    test('uses customer registration time for the period registration metric', () =>
    {
        const database = fixtureDatabase();
        const input = {
            metric: 'customer_registrations',
            dimensions: ['month'],
            timeRange: {from: '2025-02-01', to: '2025-02-28'}
        };
        const compiled = compileSemanticQuery(input);

        expect(compiled.sql).toContain('customers.joined_at >= ?');
        expect(compiled.parameters).toEqual(['2025-02-01', '2025-02-28']);
        expect(execute(database, input)).toEqual([{month: '2025-02', customer_registrations: 2}]);
    });

    test('clamps the snapshot day to the exact observed-data instant', () =>
    {
        const compiled = compileSemanticQuery({
            metric: 'eligible_revenue_eur',
            timeRange: {from: '2026-01-01', to: '2026-06-30'}
        });

        expect(compiled.sql).toContain('orders.created_at <= ?');
        expect(compiled.parameters).toEqual([
            'cancelled',
            'returned',
            '2026-01-01',
            '2026-06-30T12:00:00.000Z'
        ]);
    });

    test('canonicalizes filter ordering and values before hashing and compiling', () =>
    {
        const first = compileSemanticQuery({
            metric: 'eligible_order_count',
            dimensions: ['region'],
            filters: [
                {dimension: 'order_status', values: ['shipped', 'delayed']},
                {dimension: 'region', values: ['West', 'East']}
            ]
        });
        const second = compileSemanticQuery({
            metric: 'eligible_order_count',
            dimensions: ['region'],
            filters: [
                {dimension: 'region', values: ['East', 'West']},
                {dimension: 'order_status', values: ['delayed', 'shipped']}
            ]
        });

        expect(second.plan).toEqual(first.plan);
        expect(second.sql).toBe(first.sql);
        expect(second.parameters).toEqual(first.parameters);
        expect(second.planHash).toBe(first.planHash);
    });

    test('removes only provable enum, ordering, and limit no-ops', () =>
    {
        const baseline = compileSemanticQuery({
            metric: 'registered_customer_count',
            dimensions: ['region']
        });
        const equivalent = compileSemanticQuery({
            metric: 'registered_customer_count',
            dimensions: ['region'],
            filters: [
                {dimension: 'customer_tier', values: ['gold', 'standard', 'silver']},
                {dimension: 'region', values: ['West', 'South', 'North', 'East', 'Central']}
            ],
            orderBy: {field: 'region', direction: 'asc'},
            limit: 5
        });

        expect(equivalent.plan).toEqual(baseline.plan);
        expect(equivalent.planHash).toBe(baseline.planHash);
        expect(equivalent.sql).toBe(baseline.sql);

        for (const different of [
            compileSemanticQuery({
                metric: 'registered_customer_count',
                dimensions: ['region'],
                filters: [{dimension: 'region', values: ['East', 'West']}]
            }),
            compileSemanticQuery({
                metric: 'registered_customer_count',
                dimensions: ['region'],
                limit: 4
            }),
            compileSemanticQuery({
                metric: 'registered_customer_count',
                dimensions: ['region'],
                orderBy: {field: 'region', direction: 'desc'}
            })
        ])
        {
            expect(different.planHash).not.toBe(baseline.planHash);
        }
    });

    test('removes a month filter that exactly repeats a contiguous period', () =>
    {
        const baseline = compileSemanticQuery({
            metric: 'customer_registrations',
            dimensions: ['month'],
            timeRange: {from: '2025-01-10', to: '2025-03-05'}
        });
        const equivalent = compileSemanticQuery({
            metric: 'customer_registrations',
            dimensions: ['month'],
            filters: [{dimension: 'month', values: ['2025-03', '2025-01', '2025-02']}],
            timeRange: {from: '2025-01-10', to: '2025-03-05'},
            orderBy: {field: 'month', direction: 'asc'},
            limit: 3
        });
        const narrowerMonths = compileSemanticQuery({
            metric: 'customer_registrations',
            dimensions: ['month'],
            filters: [{dimension: 'month', values: ['2025-01', '2025-02']}],
            timeRange: {from: '2025-01-10', to: '2025-03-05'}
        });

        expect(equivalent.plan).toEqual(baseline.plan);
        expect(equivalent.planHash).toBe(baseline.planHash);
        expect(narrowerMonths.planHash).not.toBe(baseline.planHash);
    });

    test('keeps all six metric definitions executable', () =>
    {
        const database = fixtureDatabase();
        expect(execute(database, {metric: 'registered_customer_count'}))
            .toEqual([{registered_customer_count: 4}]);
        expect(execute(database, {
            metric: 'customer_registrations',
            timeRange: {from: '2025-01-01', to: '2025-02-28'}
        })).toEqual([{customer_registrations: 3}]);
        expect(execute(database, {
            metric: 'active_customer_count',
            timeRange: {from: '2026-01-01', to: '2026-02-28'}
        })).toEqual([{active_customer_count: 3}]);
        expect(execute(database, {metric: 'eligible_order_count'}))
            .toEqual([{eligible_order_count: 3}]);
        expect(execute(database, {metric: 'eligible_revenue_eur'}))
            .toEqual([{eligible_revenue_eur: 700}]);
        expect(execute(database, {metric: 'average_order_value_eur'}))
            .toEqual([{average_order_value_eur: 233.33}]);
    });
});
