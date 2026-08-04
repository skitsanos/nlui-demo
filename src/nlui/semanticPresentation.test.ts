import {describe, expect, test} from 'bun:test';
import type {DatasetQueryColumn, DatasetQueryResult} from '../data/queryTypes.ts';
import type {CanonicalSemanticQuery} from '../data/semantic/index.ts';
import {semanticPresentationFor} from './semanticPresentation.ts';
import {executeNluiTool} from './tools.ts';

const column = (
    key: string,
    name: string,
    kind: DatasetQueryColumn['kind']
): DatasetQueryColumn => ({key, name, label: name, kind});

const result = (
    columns: DatasetQueryColumn[],
    rows: DatasetQueryResult['rows'] = []
): DatasetQueryResult => ({
    queryHash: 'query-hash',
    columns,
    rows,
    returnedRowCount: rows.length,
    truncated: false
});

const plan = (
    metric: CanonicalSemanticQuery['metric'],
    dimensions: CanonicalSemanticQuery['dimensions']
): Pick<CanonicalSemanticQuery, 'metric' | 'dimensions'> => ({metric, dimensions});

describe('semantic presentation policy', () =>
{
    test('maps trusted aggregate shapes to application-owned renderers', () =>
    {
        expect(semanticPresentationFor(
            plan('registered_customer_count', []),
            result([column('c0', 'registered_customer_count', 'number')], [{c0: 200}])
        )).toEqual({presentation: 'metric', reason: 'scalar_metric'});

        expect(semanticPresentationFor(
            plan('eligible_revenue_eur', ['month']),
            result([
                column('c0', 'month', 'text'),
                column('c1', 'eligible_revenue_eur', 'number')
            ], [{c0: '2026-01', c1: 100}, {c0: '2026-02', c1: 120}])
        )).toEqual({presentation: 'line', reason: 'time_series'});

        expect(semanticPresentationFor(
            plan('eligible_revenue_eur', ['customer_tier']),
            result([
                column('c0', 'customer_tier', 'text'),
                column('c1', 'eligible_revenue_eur', 'number')
            ], [{c0: 'gold', c1: 100}, {c0: 'silver', c1: 200}])
        )).toEqual({presentation: 'bar', reason: 'categorical_breakdown'});
    });

    test('uses tables for multi-dimensional or unexpected record shapes', () =>
    {
        expect(semanticPresentationFor(
            plan('eligible_order_count', ['region', 'order_status']),
            result([
                column('c0', 'region', 'text'),
                column('c1', 'order_status', 'text'),
                column('c2', 'eligible_order_count', 'number')
            ])
        ).presentation).toBe('table');

        expect(semanticPresentationFor(
            plan('eligible_order_count', ['region']),
            result([
                column('c0', 'region', 'text'),
                column('c1', 'eligible_order_count', 'text')
            ])
        ).presentation).toBe('table');

        expect(semanticPresentationFor(
            plan('registered_customer_count', []),
            result([
                column('c0', 'registered_customer_count', 'number'),
                column('c1', 'unexpected', 'text')
            ], [{c0: 200, c1: 'record'}])
        ).presentation).toBe('table');

        expect(semanticPresentationFor(
            plan('eligible_order_count', ['region']),
            result([
                column('c0', 'region', 'text'),
                column('c1', 'eligible_order_count', 'number')
            ], [{c0: 'East', c1: 10}])
        )).toEqual({presentation: 'table', reason: 'record_set'});
    });

    test('overrides legacy model choices for scalar, categorical, temporal, and record results', async () =>
    {
        const scalar = await executeNluiTool('semantic_query', JSON.stringify({
            plan: {
                metric: 'registered_customer_count', dimensions: [], filters: [],
                timeRange: null, orderBy: null, limit: null
            },
            title: 'Registered customers',
            presentation: 'table'
        }));
        expect(scalar.modelOutput).toMatchObject({renderedAs: 'metric'});
        expect(scalar.blocks[0]).toMatchObject({type: 'stats'});

        const population = await executeNluiTool('semantic_query', JSON.stringify({
            plan: {
                metric: 'registered_customer_count', dimensions: ['customer_tier'], filters: [],
                timeRange: null, orderBy: {field: 'metric', direction: 'desc'}, limit: null
            },
            title: 'Customers by tier',
            presentation: 'table'
        }));
        expect(population.modelOutput).toMatchObject({renderedAs: 'bar'});
        expect(population.blocks[0]).toMatchObject({type: 'chart', variant: 'bar'});

        const categorical = await executeNluiTool('semantic_query', JSON.stringify({
            plan: {
                metric: 'eligible_revenue_eur', dimensions: ['customer_tier'], filters: [],
                timeRange: {from: '2026-01-01', to: '2026-06-30'},
                orderBy: {field: 'metric', direction: 'desc'}, limit: null
            },
            title: 'Revenue by tier',
            presentation: 'table'
        }));
        expect(categorical.modelOutput).toMatchObject({renderedAs: 'bar'});
        expect(categorical.blocks[0]).toMatchObject({type: 'chart', variant: 'bar'});
        expect(categorical.traceOutput).toMatchObject({
            presentationPolicy: {
                version: 1,
                requested: 'table',
                resolved: 'bar',
                renderedAs: 'bar',
                reason: 'categorical_breakdown'
            }
        });

        const temporal = await executeNluiTool('semantic_query', JSON.stringify({
            plan: {
                metric: 'eligible_order_count', dimensions: ['month'], filters: [],
                timeRange: {from: '2026-01-01', to: '2026-06-30'},
                orderBy: {field: 'month', direction: 'asc'}, limit: null
            },
            title: 'Orders by month',
            presentation: 'bar'
        }));
        expect(temporal.modelOutput).toMatchObject({renderedAs: 'line'});
        expect(temporal.blocks[0]).toMatchObject({type: 'chart', variant: 'line'});

        const records = await executeNluiTool('semantic_query', JSON.stringify({
            plan: {
                metric: 'eligible_order_count', dimensions: ['region', 'order_status'], filters: [],
                timeRange: {from: '2026-01-01', to: '2026-06-30'},
                orderBy: {field: 'metric', direction: 'desc'}, limit: 10
            },
            title: 'Orders by region and status',
            presentation: 'bar'
        }));
        expect(records.modelOutput).toMatchObject({renderedAs: 'table'});
        expect(records.blocks[0]).toMatchObject({type: 'table'});
    });

    test('accepts the presentation-free provider contract and preserves empty rendering', async () =>
    {
        const scalar = await executeNluiTool('semantic_query', JSON.stringify({
            plan: {
                metric: 'registered_customer_count', dimensions: [], filters: [],
                timeRange: null, orderBy: null, limit: null
            },
            title: 'Registered customers'
        }));
        expect(scalar.modelOutput).toMatchObject({renderedAs: 'metric'});
        expect(scalar.traceOutput).toMatchObject({
            presentationPolicy: {requested: null, resolved: 'metric', renderedAs: 'metric'}
        });

        const empty = await executeNluiTool('semantic_query', JSON.stringify({
            plan: {
                metric: 'eligible_order_count', dimensions: ['region'], filters: [],
                timeRange: {from: '2010-01-01', to: '2010-01-31'},
                orderBy: null, limit: null
            },
            title: 'Orders in January 2010'
        }));
        expect(empty.modelOutput).toMatchObject({returnedRowCount: 0, renderedAs: 'empty'});
        expect(empty.traceOutput).toMatchObject({
            presentationPolicy: {resolved: 'table', renderedAs: 'empty'}
        });
        expect(empty.blocks[0]).toMatchObject({type: 'result', status: 'info'});
    });
});
