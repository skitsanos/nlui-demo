import {DATASET_ID, DATASET_REFERENCE_DATE} from '../../data/constants.ts';
import {queryDataset} from '../../data/queryDataset.ts';
import type {DatasetQueryColumn, DatasetQueryResult} from '../../data/queryTypes.ts';
import {isSupportedTemporalValue} from '../temporal.ts';
import {queryDatasetArguments} from '../toolArguments.ts';
import type {ToolExecution} from '../toolTypes.ts';
import type {ChartBlock, NluiBlock, TableBlock} from '../types.ts';

type Presentation = 'bar' | 'line' | 'metric' | 'table' | 'text';

const currency = new Intl.NumberFormat('en', {style: 'currency', currency: 'EUR'});

const temporalColumn = (column: DatasetQueryColumn): boolean =>
    /(?:^|_)(?:date|time|datetime|timestamp|month|week|quarter|year|period)$|_at$/i.test(column.name);

const technicalColumn = (column: DatasetQueryColumn): boolean =>
    column.name.startsWith('_')
    || /(?:^|_)(?:unix(?:epoch)?|epoch|julian(?:day)?|sort)(?:_|$)/i.test(column.name);

const presentationResult = (result: DatasetQueryResult): DatasetQueryResult =>
{
    const columns = result.columns.filter((column) => !technicalColumn(column));
    const visibleKeys = new Set(columns.map(({key}) => key));
    return {
        ...result,
        columns,
        rows: result.rows.map((row) => Object.fromEntries(
            Object.entries(row).filter(([key]) => visibleKeys.has(key))
        ))
    };
};

const tableFormat = (column: DatasetQueryColumn): TableBlock['columns'][number]['format'] =>
{
    if (/_eur$/i.test(column.name)) return 'currency';
    if (/(?:^|_)status$/i.test(column.name)) return 'status';
    if (temporalColumn(column)) return 'date';
    return column.kind === 'number' ? 'number' : 'text';
};

const metricValue = (column: DatasetQueryColumn, value: unknown): string | number =>
{
    if (value === null || value === undefined) return '—';
    if (/_eur$/i.test(column.name) && typeof value === 'number') return currency.format(value);
    if (typeof value === 'string' || typeof value === 'number') return value;
    return String(value);
};

const queryOutput = (result: DatasetQueryResult, renderedAs: Presentation | 'empty') => ({
    ok: true,
    datasetId: DATASET_ID,
    snapshotAsOf: DATASET_REFERENCE_DATE,
    queryHash: result.queryHash,
    columns: result.columns,
    rows: result.rows,
    returnedRowCount: result.returnedRowCount,
    truncated: result.truncated,
    renderedAs
});

const modelQueryOutput = (result: DatasetQueryResult, renderedAs: Presentation | 'empty') =>
{
    if (renderedAs !== 'table') return queryOutput(result, renderedAs);
    return {
        ok: true,
        datasetId: DATASET_ID,
        snapshotAsOf: DATASET_REFERENCE_DATE,
        queryHash: result.queryHash,
        columns: result.columns.map(({name, label, kind}) => ({name, label, kind})),
        returnedRowCount: result.returnedRowCount,
        truncated: result.truncated,
        renderedAs,
        dataLocation: 'trusted_ui_block'
    };
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
    const temporal = temporalColumn(labelColumn)
        || data.every(({label}) => isSupportedTemporalValue(label));
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
        ...temporal && {categoryFormat: 'date' as const},
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
    if (result.columns.length === 0)
    {
        return {renderedAs: 'text', blocks: []};
    }
    const compactMetric = (requested === 'auto' || requested === 'metric')
        && result.rows.length === 1 && result.columns.length <= 8;
    if (compactMetric && result.columns.some(({kind}) => kind !== 'number'))
    {
        return {renderedAs: 'text', blocks: []};
    }
    if (compactMetric)
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
                    value: metricValue(column, row[column.key]),
                    format: tableFormat(column)
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
    const presented = presentationResult(result);
    if (result.rows.length > 0 && presented.columns.length === 0)
    {
        return {
            modelOutput: {
                ok: false,
                error: 'The query returned only technical helper columns; select at least one user-facing value.'
            },
            traceOutput: {
                ...queryOutput(result, 'text'),
                presentationColumnKeys: []
            },
            blocks: []
        };
    }
    const rendered = renderResult(presented, args.title, args.presentation);
    return {
        modelOutput: modelQueryOutput(presented, rendered.renderedAs),
        traceOutput: {
            ...queryOutput(result, rendered.renderedAs),
            presentationColumnKeys: presented.columns.map(({key}) => key)
        },
        blocks: rendered.blocks
    };
};
