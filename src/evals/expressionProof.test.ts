import {describe, expect, test} from 'bun:test';
import {evaluateSqlSemantics} from './sqlSemantics.ts';

const unit = (expression: string) => evaluateSqlSemantics({source: 'sql_semantics', label: 'EUR', tool: 'query_dataset',
    operator: 'projects_unit', expected: {sourceColumn: 'orders.total_cents', divisor: 100}},
    `SELECT ${expression} AS revenue_eur FROM orders`);

describe('whole expression units and exact grain proof', () =>
{
    test.each(['SUM(total_cents)/100.0', 'ROUND(SUM(total_cents)/100.0,2)',
        'COALESCE(SUM(total_cents),0)/100', 'SUM(total_cents/100.0)', 'ROUND(COALESCE(SUM(total_cents),0)/100,2)'])
    ('proves supported complete scaling: %s', (expression) => {expect(unit(expression)).toBeUndefined();});
    test.each(['SUM(total_cents)+1/100.0', 'CASE WHEN 1=1 THEN SUM(total_cents) ELSE 1/100.0 END',
        'SUM(total_cents)/100.0*100', 'SUM(total_cents)/100.0 + SUM(total_cents)',
        'SUM(total_cents)/10000', 'COUNT(total_cents)/100.0', 'COALESCE(SUM(total_cents),1/100.0)'])
    ('rejects a decoy or incorrect scaling path: %s', (expression) => {expect(unit(expression)).toBeDefined();});
    test.each([
        ['c.tier', true], ['segment', true], ['c.tier,o.id', false],
        ["CASE WHEN c.tier = 'gold' THEN 'gold' ELSE 'other' END", false]
    ])('requires the complete grouping grain: %s', (group, passed) =>
    {
        const result = evaluateSqlSemantics({source: 'sql_semantics', label: 'grain', tool: 'query_dataset', operator: 'groups_by',
            expected: ['customers.tier']}, `SELECT c.tier AS segment, SUM(o.total_cents) AS revenue_cents
                FROM orders o JOIN customers c ON c.id=o.customer_id GROUP BY ${group}`);
        expect(result === undefined).toBe(passed);
    });
});
