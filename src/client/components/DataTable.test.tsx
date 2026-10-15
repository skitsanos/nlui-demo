import {expect, test} from 'bun:test';
import type {ReactElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {ArtifactReceipt} from '../../analysis/artifacts.ts';
import type {TableBlock} from '../../nlui/types.ts';
import type {AnalysisSubmission} from './AnalysisControls.tsx';
import {DataTable, safeCsvCell, tableCsv, tableScrollPosition} from './DataTable.tsx';
import {NluiRenderer} from './NluiRenderer.tsx';

test('CSV export quotes cells and neutralizes spreadsheet formulas without changing displayed data', () =>
{
    expect(safeCsvCell('=HYPERLINK("https://evil.test")')).toBe('"\'=HYPERLINK(""https://evil.test"")"');
    expect(safeCsvCell(' @formula')).toBe('"\' @formula"');
    expect(safeCsvCell(-12.5)).toBe('"-12.5"');
    expect(tableCsv({id: 't', type: 'table', columns: [{key: 'id', label: 'ID'}], rowKey: 'id', rows: [{id: 'a,b"c'}]})).toBe('"ID"\r\n"a,b""c"');
});

test('analytical table sorting emits a typed parent-bound delta rather than reordering an immutable receipt', async () =>
{
    const receipt: ArtifactReceipt = {planId: 'plan', resultId: 'result', dataset: 'dataset', snapshot: '2026-06-30',
        fixtureFingerprint: 'seed', datasetRevisionBefore: 'before', datasetRevisionAfter: 'after', metric: 'registered_customer_count',
        definition: 'Registered customer count', formula: 'COUNT(*)', grain: 'customer', unit: 'count', dimensions: ['region'],
        filters: [], timeRange: null, orderBy: null, limit: null, rowCount: 1, truncated: false, warnings: [],
        planHash: 'plan-hash', queryHash: 'query-hash', resultHash: 'result-hash'};
    const block: TableBlock = {id: 'table', type: 'table', rowKey: 'c0', columns: [{key: 'c0', label: 'Region'}, {key: 'c1', label: 'Customers'}],
        rows: [{c0: 'West', c1: 40}], analysis: receipt};
    const submitted: AnalysisSubmission[] = [];
    const fragment = DataTable({block, onAnalyze: async (delta) => {submitted.push(delta); return true;}});
    const section = fragment.props.children[2] as ReactElement<{children: ReactElement<Record<string, any>>}>;
    const table = section.props.children;
    expect(table.props.columns[1].sorter).toBeTrue();
    table.props.onChange({}, {}, {columnKey: 'c1', order: 'descend'}, {action: 'sort'});
    expect(submitted).toEqual([{parentResultId: 'result', delta: {orderBy: {field: 'metric', direction: 'desc'}}}]);
    expect(receipt.orderBy).toBeNull();
    expect(block.rows).toEqual([{c0: 'West', c1: 40}]);
});
test('expired and superseded controls expose readable lifecycle state and cannot be clicked after replay', () =>
{
    const block = {id: 'choice', type: 'choices' as const, interactionId: 'pick', controlExpiresAt: '2026-01-01T00:00:00Z', options: [{value: 'one', label: 'One'}]};
    const expired = renderToStaticMarkup(<NluiRenderer blocks={[block]} now={Date.parse('2026-10-15')} conversationId="conversation-test" onInteraction={async () => true}/>);
    expect(expired).toContain('Expired'); expect(expired).toContain('disabled');
    const superseded = renderToStaticMarkup(<NluiRenderer blocks={[block]} states={{pick: 'superseded'}} conversationId="conversation-test" onInteraction={async () => true}/>);
    expect(superseded).toContain('Superseded'); expect(superseded).toContain('fresh proposal');
});

test('table keyboard panning clamps its horizontal viewport without intercepting sort/activation keys', () =>
{
    expect(tableScrollPosition('ArrowRight', 0, 1000, 300)).toBe(80);
    expect(tableScrollPosition('ArrowLeft', 0, 1000, 300)).toBe(0);
    expect(tableScrollPosition('End', 0, 1000, 300)).toBe(700);
    expect(tableScrollPosition('Home', 500, 1000, 300)).toBe(0);
    expect(tableScrollPosition('ArrowRight', 700, 1000, 300)).toBe(700);
    expect(tableScrollPosition('Enter', 100, 1000, 300)).toBeUndefined();
});
