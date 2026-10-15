import {describe, expect, test} from 'bun:test';
import {canonicalizeDatasetQuery} from './queryPolicy.ts';

describe('required relationship joins', () =>
{
    test.each([
        ['old alias only', 'o.customer_id = c.id'],
        ['inverted equality', '(o.customer_id = c2.id) = 0'],
        ['negation', 'NOT (o.customer_id = c2.id)'],
        ['function wrapper', 'coalesce(o.customer_id = c2.id, 1) = 1'],
        ['CASE wrapper', 'CASE WHEN o.customer_id = c2.id THEN 1 ELSE 1 END = 1'],
        ['disjunction', 'o.customer_id = c2.id OR 1 = 1'],
        ['self alias equality', 'c2.id = c2.id']
    ])('rejects a relationship hidden by %s', (_name, predicate) =>
    {
        expect(() => canonicalizeDatasetQuery(`
            SELECT COUNT(*) AS row_count FROM orders o
            JOIN customers c ON o.customer_id = c.id
            JOIN customers c2 ON ${predicate}
        `)).toThrow(/^SQL_POLICY:/);
    });

    test.each([
        `SELECT o.id FROM orders o JOIN customers c ON o.customer_id = c2.id
            JOIN customers c2 ON o.customer_id = c2.id`,
        'SELECT o.id FROM orders o JOIN customers c ON orders.customer_id = c.id',
        'SELECT o.id FROM orders o JOIN customers o ON o.customer_id = o.id',
        `SELECT o.id FROM orders o JOIN customers c ON o.customer_id = c.id
            AND c.id IN (SELECT id FROM customers)`
    ])('rejects invalid or nested alias scope', (sql) =>
    {
        expect(() => canonicalizeDatasetQuery(sql)).toThrow(/^SQL_POLICY:/);
    });

    test.each([
        'SELECT orders.id FROM orders JOIN customers ON customers.id = orders.customer_id',
        `SELECT o.id FROM orders o LEFT JOIN customers c
            ON ((c.id = o.customer_id) AND c.tier = 'gold')`,
        `SELECT p.name FROM orders o JOIN order_items i ON i.order_id = o.id
            JOIN products p ON p.id = i.product_id`,
        `SELECT o.id FROM orders o JOIN customers c ON c.id = o.customer_id
            JOIN customers c2 ON c2.id = o.customer_id`
    ])('accepts a direct required relationship in each introduced scope', (sql) =>
    {
        // canonicalizeDatasetQuery validates both the input and serialized AST.
        expect(canonicalizeDatasetQuery(sql)).toContain('JOIN');
    });

    test('preserves relationship validation for application-bound parameters', () =>
    {
        expect(canonicalizeDatasetQuery(`SELECT o.id FROM orders o JOIN customers c
            ON c.id = o.customer_id AND c.tier = ?`, {allowParameters: true})).toContain('?');
    });
});
