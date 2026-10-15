import {describe, expect, test} from 'bun:test';
import type {DeterministicAssertion} from './assertionSchema.ts';
import {evaluateSqlSemantics} from './sqlSemantics.ts';

type SqlAssertion = Extract<DeterministicAssertion, {source: 'sql_semantics'}>;
const exclusions: SqlAssertion = {
    source: 'sql_semantics', label: 'eligible orders', tool: 'query_dataset', operator: 'excludes_values',
    expected: {column: 'orders.status', values: ['cancelled', 'returned']}
};
const time: SqlAssertion = {
    source: 'sql_semantics', label: 'sales period', tool: 'query_dataset', operator: 'uses_time_field',
    expected: {column: 'orders.created_at', clause: 'filter'}
};
const query = (predicate: string): string => `SELECT COUNT(*) AS n FROM orders WHERE ${predicate}`;
const exclusion = "status NOT IN ('cancelled', 'returned')";

describe('effective SQL semantic grading', () =>
{
    test.each([
        exclusion,
        `${exclusion} AND region = 'West'`,
        `region = 'West' AND ${exclusion}`,
        "status != 'cancelled' AND 'returned' <> status",
        "status <> 'returned' AND 'cancelled' != status",
        `(${exclusion} AND region = 'West') OR (${exclusion} AND region = 'East')`,
        `(status != 'returned' OR 'returned' <> status) AND status != 'cancelled'`
    ])('proves every exclusion on every branch: %s', (predicate) =>
    {
        expect(evaluateSqlSemantics(exclusions, query(predicate))).toBeUndefined();
    });

    test.each([
        `${exclusion} OR 1 = 1`,
        `1 = 1 OR ${exclusion}`,
        `(${exclusion} AND region = 'West') OR region = 'East'`,
        "status != 'cancelled' OR status != 'returned'",
        "status NOT IN ('cancelled')",
        `NOT status NOT IN ('cancelled', 'returned')`,
        `(${exclusion}) = 0`,
        `CASE WHEN ${exclusion} THEN 1 ELSE 1 END = 1`,
        "status NOT IN (COALESCE('cancelled', 'returned'))",
        "status NOT IN ('cancelled', CASE WHEN region = 'West' THEN 'returned' ELSE 'shipped' END)",
        "status NOT IN (SELECT status FROM orders WHERE status NOT IN ('cancelled', 'returned'))",
        "status != 'cancelled' AND status != NULL"
    ])('does not collect exclusions from decoy fragments: %s', (predicate) =>
    {
        expect(evaluateSqlSemantics(exclusions, query(predicate))).toContain('SQL did not satisfy');
    });

    test.each([
        "created_at >= '2026-01-01'",
        "'2026-01-01' <= created_at",
        "created_at BETWEEN '2026-01-01' AND '2026-06-30'",
        "created_at >= '2026-01-01' AND (region = 'West' OR 1 = 1)",
        "(created_at >= '2026-01-01' AND region = 'West') OR created_at >= '2026-02-01'"
    ])('proves an effective direct time-field filter: %s', (predicate) =>
    {
        expect(evaluateSqlSemantics(time, query(predicate))).toBeUndefined();
    });

    test.each([
        "created_at >= '2026-01-01' OR 1 = 1",
        "NOT created_at >= '2026-01-01'",
        "(created_at >= '2026-01-01') = 0",
        "CASE WHEN created_at >= '2026-01-01' THEN 1 ELSE 1 END = 1",
        "created_at = created_at",
        "id IN (SELECT id FROM orders WHERE created_at >= '2026-01-01')"
    ])('fails closed for unproven time filters: %s', (predicate) =>
    {
        expect(evaluateSqlSemantics(time, query(predicate))).toContain('SQL did not satisfy');
    });

    test('does not borrow exclusions from the wrong table or an ambiguous column', () =>
    {
        const from = `SELECT COUNT(*) AS n FROM orders o JOIN shipments s ON s.order_id = o.id WHERE`;
        expect(evaluateSqlSemantics(exclusions, `${from} s.status NOT IN ('cancelled', 'returned')`)).toContain('SQL did not satisfy');
        for (const column of ['status', 'unknown.status'])
            expect(evaluateSqlSemantics(exclusions, `${from} ${column} NOT IN ('cancelled', 'returned')`)).toContain('SQL_POLICY');
        expect(evaluateSqlSemantics(exclusions, `${from} o.status NOT IN ('cancelled', 'returned')`)).toBeUndefined();
    });

    test('cannot borrow any semantic evidence from an unused SELECT scope', () =>
    {
        const sql = `WITH unused AS (
            SELECT c.tier AS tier, SUM(o.total_cents) / 100.0 AS revenue_eur
            FROM customers c JOIN orders o ON o.customer_id = c.id
            WHERE o.created_at >= '2026-01-01' AND o.status NOT IN ('cancelled', 'returned')
            GROUP BY c.tier
        ) SELECT COUNT(*) AS n FROM products`;
        const assertions: SqlAssertion[] = [exclusions, time,
            {...time, expected: {column: 'orders.created_at', clause: 'any'}},
            {...time, expected: {column: 'orders.created_at', clause: 'group'}},
            {source: 'sql_semantics', label: 'join', tool: 'query_dataset', operator: 'has_join',
                expected: {left: 'customers.id', right: 'orders.customer_id'}},
            {source: 'sql_semantics', label: 'grain', tool: 'query_dataset', operator: 'groups_by',
                expected: ['customers.tier']},
            {source: 'sql_semantics', label: 'units', tool: 'query_dataset', operator: 'projects_unit',
                expected: {sourceColumn: 'orders.total_cents', divisor: 100}}
        ];
        for (const assertion of assertions) expect(evaluateSqlSemantics(assertion, sql)).toContain('SQL did not satisfy');
    });

    test('retains positive join, quoting, unqualified schema resolution and grouping alias coverage', () =>
    {
        const sql = `SELECT strftime('%Y-%m', o.created_at) AS month, SUM(o.total_cents) / 100 AS revenue_eur
            FROM orders o JOIN customers c ON "c"."id" = "o"."customer_id"
            WHERE o.status NOT IN ('cancelled', 'returned') AND joined_at >= '2025-01-01'
            GROUP BY month`;
        expect(evaluateSqlSemantics(exclusions, sql)).toBeUndefined();
        expect(evaluateSqlSemantics({...time, expected: {column: 'customers.joined_at', clause: 'filter'}}, sql))
            .toBeUndefined();
        expect(evaluateSqlSemantics({...time, expected: {column: 'orders.created_at', clause: 'group'}}, sql))
            .toBeUndefined();
        expect(evaluateSqlSemantics({source: 'sql_semantics', label: 'join', tool: 'query_dataset', operator: 'has_join',
            expected: {left: 'orders.customer_id', right: 'customers.id'}}, sql)).toBeUndefined();
    });
});
