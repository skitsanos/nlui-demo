import {DATASET_ID, DATASET_REFERENCE_DATE} from '../../data/constants.ts';
import {queryDataset} from '../../data/queryDataset.ts';
import type {DatasetQueryColumn, DatasetQueryResult} from '../../data/queryTypes.ts';
import {queryDatasetArguments} from '../toolArguments.ts';
import type {ToolExecution} from '../toolTypes.ts';
import type {ChartBlock, NluiBlock, TableBlock} from '../types.ts';

type Presentation = 'bar' | 'line' | 'metric' | 'table';

const currency = new Intl.NumberFormat('en', {style: 'currency', currency: 'EUR'});

const tableFormat = (column: DatasetQueryColumn): TableBlock['columns'][number]['format'] =>
{
    if (/_eur$/i.test(column.name)) return 'currency';
    if (/(?:^|_)status$/i.test(column.name)) return 'status';
    if (/(?:date|time|month|period|_at)$/i.test(column.name)) return 'date';
    return column.kind === 'number' ? 'number' : 'text';
};

const metricValue = (column: DatasetQueryColumn, value: unknown): string | number =>
{
    if (value === null || value === undefined) return '—';
    if (/_eur$/i.test(column.name) && typeof value === 'number') return currency.format(value);
    if (typeof value === 'string' || typeof value === 'number') return value;
    return String(value);
};

const tableBlock = (result: DatasetQueryResult, title: string): TableBlock => ({
    id: crypto.randomUUID(),
    type: 'table',
    title: result.truncated ? `${title} — first ${result.returnedRowCount} rows` : title,
    columns: result.columns.map((column) => ({
        key: column.key,
        label: column.label,
        format: tableFormat(column)
    })),
    rows: result.rows.map((row, index) => ({...row, __row_id: index + 1})),
    rowKey: '__row_id'
});

const temporalColumn = (column: DatasetQueryColumn): boolean =>
    /(?:date|time|month|week|quarter|year|period|_at)$/i.test(column.name);

const chartBlock = (
    result: DatasetQueryResult,
    title: string,
    requested: 'auto' | 'bar' | 'line'
): ChartBlock | undefined =>
{
    if (result.rows.length < 2 || result.rows.length > 24 || result.columns.length !== 2) return undefined;
    const labelColumn = result.columns.find(({name}) => name.toLowerCase() === 'label')
        ?? result.columns.find(({kind}) => kind === 'text');
    const valueColumn = result.columns.find(({name}) => name.toLowerCase() === 'value')
        ?? result.columns.find(({kind}) => kind === 'number');
    if (!labelColumn || !valueColumn || labelColumn.key === valueColumn.key) return undefined;

    const data: Array<Record<string, string | number>> = [];
    for (const row of result.rows)
    {
        const label = row[labelColumn.key];
        const value = row[valueColumn.key];
        if (!['string', 'number'].includes(typeof label) || typeof value !== 'number' || !Number.isFinite(value))
        {
            return undefined;
        }
        data.push({label: String(label), value});
    }
    const temporal = temporalColumn(labelColumn);
    const variant = requested === 'line' && temporal ? 'line'
        : requested === 'auto' && temporal ? 'line'
            : 'bar';
    return {
        id: crypto.randomUUID(),
        type: 'chart',
        title,
        variant,
        categoryKey: 'label',
        valueKey: 'value',
        valueLabel: /_eur$/i.test(valueColumn.name) ? `${valueColumn.label} (EUR)` : valueColumn.label,
        data
    };
};

const renderResult = (
    result: DatasetQueryResult,
    title: string,
    requested: 'auto' | 'metric' | 'table' | 'bar' | 'line'
): {blocks: NluiBlock[]; renderedAs: Presentation | 'empty'} =>
{
    if (result.rows.length === 0)
    {
        return {
            renderedAs: 'empty',
            blocks: [{
                id: crypto.randomUUID(),
                type: 'result',
                status: 'info',
                title,
                message: 'No rows matched this question in the demo dataset.'
            }]
        };
    }
    if ((requested === 'auto' || requested === 'metric') && result.rows.length === 1 && result.columns.length <= 8)
    {
        const row = result.rows[0]!;
        return {
            renderedAs: 'metric',
            blocks: [{
                id: crypto.randomUUID(),
                type: 'stats',
                title,
                items: result.columns.map((column) => ({
                    label: column.label,
                    value: metricValue(column, row[column.key])
                }))
            }]
        };
    }
    if (requested === 'auto' || requested === 'bar' || requested === 'line')
    {
        const chart = chartBlock(result, title, requested);
        if (chart) return {renderedAs: chart.variant, blocks: [chart]};
    }
    return {renderedAs: 'table', blocks: [tableBlock(result, title)]};
};

export const queryDatasetHandler = async (raw: unknown): Promise<ToolExecution> =>
{
    const args = queryDatasetArguments.parse(raw);
    const result = await queryDataset(args.sql);
    const rendered = renderResult(result, args.title, args.presentation);
    return {
        modelOutput: {
            ok: true,
            datasetId: DATASET_ID,
            snapshotAsOf: DATASET_REFERENCE_DATE,
            columns: result.columns,
            rows: result.rows,
            returnedRowCount: result.returnedRowCount,
            truncated: result.truncated,
            renderedAs: rendered.renderedAs
        },
        blocks: rendered.blocks
    };
};
