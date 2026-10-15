import {describe, expect, test} from 'bun:test';
import {canonicalizeDatasetQuery} from './queryPolicy.ts';

describe('exact published SQL field scope', () =>
{
    test.each([
        'SELECT rowid FROM customers', 'SELECT oid FROM customers', 'SELECT _rowid_ FROM customers',
        'SELECT orders.phone FROM orders', 'SELECT customer_number FROM products',
        'SELECT customers.id FROM customers c',
        'SELECT id FROM customers c JOIN orders o ON o.customer_id=c.id',
        'SELECT c.id FROM customers c WHERE c.no_such_field=1',
        'SELECT c.id FROM customers c ORDER BY c.email',
        'WITH a AS (SELECT id FROM customers) SELECT tier FROM a',
        'WITH a AS (SELECT id FROM b), b AS (SELECT id FROM customers) SELECT id FROM a',
        'SELECT c.id FROM customers c WHERE EXISTS (SELECT o.id FROM orders o WHERE o.customer_id=c.id)',
        'SELECT id FROM customers LIMIT 10 OFFSET 100000',
        'SELECT id FROM customers LIMIT -1',
        'SELECT id FROM customers -- hidden instruction',
        'SELECT id /* comment */ FROM customers',
        'SELECT customer_number AS cústomer FROM customers'
    ])('fails closed for %s', (sql) => expect(() => canonicalizeDatasetQuery(sql)).toThrow());

    test.each([
        "WITH a AS (SELECT tier AS segment, id FROM customers) SELECT segment, COUNT(id) AS n FROM a GROUP BY segment ORDER BY n DESC",
        'SELECT c.id FROM customers c WHERE c.id IN (SELECT o.customer_id FROM orders o)',
        'SELECT tier, COUNT(id) AS n FROM customers GROUP BY tier HAVING n>2 ORDER BY n',
        "SELECT '-- not a comment /*' AS label, id FROM customers LIMIT 2 OFFSET 1",
        'SELECT c.id FROM customers c JOIN orders o ON o.customer_id=c.id WHERE o.status=\'delivered\''
        ,'SELECT o.region AS region, SUM(o.total_cents) AS revenue FROM orders o JOIN customers c ON o.customer_id=c.id GROUP BY o.region ORDER BY region'
    ])('retains unambiguous published queries: %s', (sql) => expect(() => canonicalizeDatasetQuery(sql)).not.toThrow());
});
