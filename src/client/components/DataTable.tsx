import {Button, Table} from 'antd';
import type {TableBlock} from '../../nlui/types.ts';
import type {AnalysisSubmission} from './AnalysisControls.tsx';
import {FormattedValue} from './FormattedValue.tsx';

// Spreadsheet programs can execute cells beginning with formula prefixes.
export const safeCsvCell = (value: unknown): string =>
{
    const text = value === null || value === undefined ? '' : String(value);
    return `"${(typeof value === 'string' && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
};
export const tableCsv = (block: TableBlock): string => [block.columns.map(({label}) => safeCsvCell(label)).join(','),
    ...block.rows.map((row) => block.columns.map(({key}) => safeCsvCell(row[key])).join(','))].join('\r\n');

export const tableScrollPosition = (key: string, left: number, width: number, viewport: number): number | undefined =>
{
    const maximum = Math.max(0, width - viewport);
    return key === 'ArrowRight' ? Math.min(maximum, left + 80) : key === 'ArrowLeft' ? Math.max(0, left - 80)
        : key === 'Home' ? 0 : key === 'End' ? maximum : undefined;
};

const download = (block: TableBlock): void =>
{
    const url = URL.createObjectURL(new Blob(['\uFEFF', tableCsv(block)], {type: 'text/csv;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = 'nlui-result.csv'; link.click();
    URL.revokeObjectURL(url);
};

export const DataTable = ({block, onAnalyze, disabled}: {block: TableBlock; onAnalyze?: (input: AnalysisSubmission) => Promise<boolean>; disabled?: boolean}) => <>
    <Button size="small" onClick={() => download(block)} aria-label={`Export ${block.title ?? 'data table'} as CSV`}>Export CSV</Button>
    <span className="table-scroll-hint">{block.analysis && onAnalyze ? 'Sorting creates a traced refinement.' : 'Sort/export apply to these rows.'} ← / → to scroll.</span>
    {/* biome-ignore lint/a11y/noNoninteractiveTabindex: This named horizontally scrollable region needs keyboard access. */}
    <section className="nlui-table-region" aria-label={block.title ?? 'Data table'} tabIndex={0}
        aria-description="Use Left and Right arrow keys, Home or End to scroll this table horizontally."
        onKeyDown={(event) =>
        {
            if (event.target !== event.currentTarget) return;
            const scroller = event.currentTarget.querySelector<HTMLElement>('.ant-table-content');
            if (!scroller) return;
            const left = tableScrollPosition(event.key, scroller.scrollLeft, scroller.scrollWidth, scroller.clientWidth);
            if (left === undefined) return;
            event.preventDefault(); scroller.scrollTo({left, behavior: 'auto'});
        }}>
        <Table className="nlui-table" rowKey={(row) => String(row[block.rowKey])} dataSource={block.rows}
            columns={block.columns.map((column, index) => ({title: column.label, dataIndex: column.key, key: column.key,
                minWidth: column.format === 'date' ? 176 : column.format === 'number' ? 96 : 160,
                align: column.format === 'number' || column.format === 'currency' ? 'right' : 'left',
                sorter: block.analysis && onAnalyze ? !disabled : (a, b) => typeof a[column.key] === 'number' && typeof b[column.key] === 'number'
                    ? Number(a[column.key]) - Number(b[column.key]) : String(a[column.key] ?? '').localeCompare(String(b[column.key] ?? '')),
                ...block.analysis && onAnalyze && {sortOrder: block.analysis.orderBy?.field === (index === block.analysis.dimensions.length ? 'metric' : block.analysis.dimensions[index])
                    ? block.analysis.orderBy.direction === 'asc' ? 'ascend' as const : 'descend' as const : null},
                render: (value: TableBlock['rows'][number][string]) => <FormattedValue value={value} format={column.format}/>
            }))} onChange={(_page, _filters, sorter, extra) =>
            {
                if (!block.analysis || !onAnalyze || disabled || extra.action !== 'sort' || Array.isArray(sorter)) return;
                const index = block.columns.findIndex(({key}) => key === sorter.columnKey);
                if (index < 0) return;
                const field = index === block.analysis.dimensions.length ? 'metric' : block.analysis.dimensions[index];
                if (!field) return;
                void onAnalyze({parentResultId: block.analysis.resultId, delta: {orderBy: sorter.order
                    ? {field: field as 'metric' | import('../../data/semantic/catalog.ts').SemanticDimensionId,
                        direction: sorter.order === 'ascend' ? 'asc' : 'desc'} : null}});
            }} size="small" scroll={{x: 'max-content'}} pagination={block.rows.length > 8 ? {pageSize: 8, size: 'small'} : false}/>
    </section>
</>;
