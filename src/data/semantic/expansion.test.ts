import {Database} from 'bun:sqlite';
import {expect, test} from 'bun:test';
import {canonicalizeDatasetQuery} from '../queryPolicy.ts';
import {compileSemanticQuery, SEMANTIC_METRICS} from './index.ts';
import {semanticCatalogGuide, semanticCatalogMarkdown, semanticCatalogMetadata} from './metadata.ts';

test('v3 metadata generates guidance/docs with every formula, grain, unit, exclusions and valid dimensions', () =>
{
    const catalog = semanticCatalogMetadata();
    expect(catalog.version).toBe(3); expect(catalog.metrics).toHaveLength(8);
    for (const metric of catalog.metrics)
    {
        expect(metric.formula).toBe(SEMANTIC_METRICS[metric.id].expression);
        expect(metric.grain).toBeTruthy(); expect(metric.unit).toBeTruthy(); expect(metric.synonyms.length).toBeGreaterThan(0);
        expect(Array.isArray(metric.exclusions)).toBeTrue(); expect(metric.allowedDimensions.length).toBeGreaterThan(0);
        expect(semanticCatalogGuide()).toContain(metric.id); expect(semanticCatalogMarkdown()).toContain(metric.formula);
    }
});

test('line-grain merchandise cannot multiply totals and completed refunds use return time, not order time', () =>
{
    const db = new Database(':memory:');
    try
    {
        db.run(`CREATE TABLE customers(id INTEGER,tier TEXT); CREATE TABLE orders(id INTEGER,customer_id INTEGER,status TEXT,region TEXT,created_at TEXT,total_cents INTEGER);
            CREATE TABLE products(id INTEGER,category TEXT); CREATE TABLE order_items(id INTEGER,order_id INTEGER,product_id INTEGER,line_total_cents INTEGER);
            CREATE TABLE returns(id INTEGER,order_id INTEGER,status TEXT,requested_at TEXT,refund_cents INTEGER);
            INSERT INTO customers VALUES(1,'gold'); INSERT INTO products VALUES(1,'Laptops'),(2,'Audio');
            INSERT INTO orders VALUES(1,1,'delivered','West','2026-06-10',99000),(2,1,'cancelled','West','2026-06-10',10000),(3,1,'returned','East','2026-05-10',30000);
            INSERT INTO order_items VALUES(1,1,1,20000),(2,1,2,5000),(3,2,1,10000);
            INSERT INTO returns VALUES(1,3,'completed','2026-06-12',30000),(2,1,'requested','2026-06-14',4000),(3,3,'completed','2026-05-12',1000);`);
        const period = {from: '2026-06-01', to: '2026-06-30'};
        const merch = compileSemanticQuery({metric: 'merchandise_revenue_eur', dimensions: ['product_category', 'customer_tier'], timeRange: period});
        expect(() => canonicalizeDatasetQuery(merch.sql, {allowParameters: true})).not.toThrow();
        expect(db.query(merch.sql).all(...merch.parameters)).toEqual([
            {product_category: 'Audio', customer_tier: 'gold', merchandise_revenue_eur: 50},
            {product_category: 'Laptops', customer_tier: 'gold', merchandise_revenue_eur: 200}
        ]);
        const refund = compileSemanticQuery({metric: 'completed_refunds_eur', dimensions: ['region'], timeRange: period});
        expect(() => canonicalizeDatasetQuery(refund.sql, {allowParameters: true})).not.toThrow();
        expect(db.query(refund.sql).all(...refund.parameters)).toEqual([{region: 'East', completed_refunds_eur: 300}]);
    }
    finally {db.close();}
});
