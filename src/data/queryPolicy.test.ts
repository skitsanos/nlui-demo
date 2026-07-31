import {describe, expect, test} from 'bun:test';
import {canonicalizeDatasetQuery, datasetQueryHasWhereEquality} from './queryPolicy.ts';

describe('dataset SQL policy', () =>
{
    test('inspects equality filters semantically across quoting and operand order', () =>
    {
        expect(datasetQueryHasWhereEquality(
            "SELECT MAX(joined_at) AS joined_at FROM customers c WHERE c.tier = 'gold'",
            'tier',
            'gold'
        )).toBeTrue();
        expect(datasetQueryHasWhereEquality(
            "SELECT MAX(joined_at) AS joined_at FROM customers WHERE 'gold' = tier",
            'tier',
            'gold'
        )).toBeTrue();
        expect(datasetQueryHasWhereEquality(
            'SELECT MAX(joined_at) AS joined_at FROM customers',
            'tier',
            'gold'
        )).toBeFalse();
    });

    test('canonicalizes a single aggregate SELECT', () =>
    {
        const sql = canonicalizeDatasetQuery('SELECT COUNT(*) AS customer_count FROM customers');
        expect(sql).toBe('SELECT COUNT(*) AS "customer_count" FROM "customers"');
    });

    test('allows bounded CTEs, functions, and published relationship joins', () =>
    {
        expect(() => canonicalizeDatasetQuery(`
            WITH recent AS (
                SELECT customer_id FROM orders WHERE created_at >= '2026-01-01'
            )
            SELECT COUNT(DISTINCT customer_id) AS active_customer_count FROM recent
        `)).not.toThrow();
        expect(() => canonicalizeDatasetQuery(`
            SELECT c.tier AS label, ROUND(SUM(o.total_cents) / 100.0, 2) AS value
            FROM customers AS c
            INNER JOIN orders AS o ON o.customer_id = c.id
            WHERE o.status NOT IN ('cancelled', 'returned')
            GROUP BY c.tier
            ORDER BY value DESC
        `)).not.toThrow();
    });

    test.each([
        ['multiple statements', 'SELECT COUNT(*) FROM customers; DELETE FROM customers'],
        ['write', 'UPDATE customers SET tier = \'gold\''],
        ['attach', 'ATTACH DATABASE \'other.sqlite\' AS other'],
        ['recursive CTE', 'WITH RECURSIVE x(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM x) SELECT n FROM x'],
        ['compound SELECT', 'SELECT id FROM customers UNION SELECT id FROM customers'],
        ['schema qualifier', 'SELECT id FROM main.customers'],
        ['table-valued function', 'SELECT name FROM pragma_table_info(\'customers\')'],
        ['unsafe function', 'SELECT load_extension(\'extension\') FROM customers'],
        ['wildcard', 'SELECT * FROM customers'],
        ['qualified wildcard', 'SELECT customers.* FROM customers'],
        ['hidden column', 'SELECT email FROM customers'],
        ['double-quoted hidden column', 'SELECT "email" AS exposed FROM customers'],
        ['double-quoted literal ambiguity', 'SELECT strftime("%Y-%m", created_at) AS label FROM orders'],
        ['implicit join', 'SELECT orders.id FROM orders, customers'],
        ['cartesian join', 'SELECT o.id FROM orders AS o JOIN customers AS c ON 1 = 1'],
        ['parameter', 'SELECT id FROM customers WHERE id = ?'],
        ['computed column without alias', 'SELECT unixepoch(MAX(joined_at)) FROM customers'],
        ['non-snake-case alias', 'SELECT MAX(joined_at) AS "Latest registration" FROM customers']
    ])('rejects %s', (_name, sql) =>
    {
        expect(() => canonicalizeDatasetQuery(sql)).toThrow(/^SQL_(?:INVALID|POLICY):/);
    });
});
