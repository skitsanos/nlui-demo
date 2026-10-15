import {describe, expect, test} from 'bun:test';
import {canonicalizeDatasetQuery, datasetQueryHasWhereEquality} from './queryPolicy.ts';

const provesGold = (sql: string): boolean => datasetQueryHasWhereEquality(sql, 'tier', 'gold');
const customerCount = (predicate: string): string => `SELECT COUNT(*) AS n FROM customers WHERE ${predicate}`;

describe('effective SQL equality proof', () =>
{
    test.each([
        "tier = 'gold'",
        "'gold' = tier",
        "`tier` = 'gold'",
        "tier = 'gold' AND region = 'West'",
        "region = 'West' AND tier = 'gold'",
        "(tier = 'gold' AND region = 'West') OR (region = 'East' AND 'gold' = tier)",
        "tier = 'gold' AND (region = 'West' OR 1 = 1)"
    ])('proves required conjunctions and every alternative: %s', (predicate) =>
    {
        expect(provesGold(customerCount(predicate))).toBeTrue();
    });

    test.each([
        "tier = 'gold' OR 1 = 1",
        "1 = 1 OR tier = 'gold'",
        "tier = 'gold' OR tier = 'silver'",
        "(tier = 'gold' AND region = 'West') OR region = 'East'",
        "NOT tier = 'gold'",
        "(tier = 'gold') = 0",
        "(tier = 'gold') != 1",
        "CASE WHEN tier = 'gold' THEN 1 ELSE 1 END = 1",
        "COALESCE(tier = 'gold', 1) = 1",
        "tier = 'GOLD'",
        "'tier' = 'gold'",
        "unknown_column = 'gold'",
        "tier = tier",
        "tier IN ('gold')",
        "id IN (SELECT id FROM customers WHERE tier = 'gold')"
    ])('fails closed for ineffective or unsupported evidence: %s', (predicate) =>
    {
        expect(provesGold(customerCount(predicate))).toBeFalse();
    });

    test('ignores unrelated SELECTs and does not invent CTE lineage', () =>
    {
        const cte = "WITH gold_customers AS (SELECT id FROM customers WHERE tier = 'gold')";
        expect(provesGold(`${cte} SELECT COUNT(*) AS n FROM customers`)).toBeFalse();
        expect(provesGold(`${cte} SELECT COUNT(*) AS n FROM gold_customers`)).toBeFalse();
        expect(provesGold(`${cte} ${customerCount("tier = 'gold'")}`)).toBeTrue();
    });

    test('resolves visible aliases, schema ownership and qualified quoted names', () =>
    {
        const from = 'SELECT COUNT(*) AS n FROM customers c JOIN orders o ON o.customer_id = c.id WHERE';
        expect(provesGold(`${from} tier = 'gold'`)).toBeTrue();
        expect(provesGold(`${from} "c"."tier" = 'gold'`)).toBeTrue();
        expect(provesGold(`${from} unknown_alias.tier = 'gold'`)).toBeFalse();
        expect(provesGold(`${from} o.tier = 'gold'`)).toBeFalse();
        expect(provesGold(`${from} customers.tier = 'gold'`)).toBeFalse();
        const ambiguous = `${from} region = 'West'`;
        expect(datasetQueryHasWhereEquality(ambiguous, 'region', 'West')).toBeFalse();
    });

    test('cannot conflate different instances of a repeated table', () =>
    {
        expect(provesGold(`SELECT COUNT(*) AS n FROM customers c
            JOIN orders o ON o.customer_id = c.id
            JOIN customers other ON o.customer_id = other.id
            WHERE c.tier = 'gold'`)).toBeFalse();
    });

    test('retains runtime rejection for unsupported NOT function syntax and raw ambiguous quotes', () =>
    {
        expect(() => provesGold(customerCount("NOT(tier = 'gold')"))).toThrow('SQL_POLICY');
        expect(() => provesGold(customerCount('tier = "gold"'))).toThrow('SQL_POLICY');
        expect(() => canonicalizeDatasetQuery(`WITH segments AS (SELECT tier FROM customers)
            SELECT tier FROM segments`)).not.toThrow();
    });
});
