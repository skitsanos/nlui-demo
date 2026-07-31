import {createHash} from 'node:crypto';
import {canonicalizeDatasetQuery} from './queryPolicy.ts';
import {
    type DatasetColumnKind,
    type DatasetQueryCell,
    type DatasetQueryColumn,
    DatasetQueryError,
    type DatasetQueryParameter,
    type DatasetQueryResult,
    type QueryWorkerRequest,
    type QueryWorkerResponse
} from './queryTypes.ts';
import {ensureDemoDatabase} from './seed.ts';
import type {DataLayerOptions} from './types.ts';

const MAX_ROWS = 100;
const MAX_COLUMNS = 12;
const MAX_CELL_CHARACTERS = 500;
const MAX_RESULT_BYTES = 96 * 1024;
const DEFAULT_TIMEOUT_MS = 1_500;
const MAX_PARAMETERS = 32;
const workerUrl = new URL('./queryWorker.ts', import.meta.url).href;

const closeWorker = (worker: Worker): void =>
{
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
};

export const runCanonicalDatasetQuery = (
    request: QueryWorkerRequest,
    timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<QueryWorkerResponse> => new Promise((resolve, reject) =>
{
    const worker = new Worker(workerUrl, {name: 'nlui-dataset-query'});
    let settled = false;
    const finish = (callback: () => void): void =>
    {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        closeWorker(worker);
        callback();
    };
    const timeout = setTimeout(() => finish(() => reject(new DatasetQueryError(
        'SQL_TIMEOUT',
        'The query exceeded the execution limit; simplify or narrow it.'
    ))), timeoutMs);

    worker.onmessage = (event: MessageEvent<QueryWorkerResponse>) => finish(() => resolve(event.data));
    worker.onerror = () => finish(() => reject(new DatasetQueryError(
        'SQL_INTERNAL',
        'The isolated dataset query worker failed.'
    )));
    worker.postMessage(request);
});

const humanize = (name: string): string =>
{
    const withoutUnit = name.replace(/_(?:eur|cents)$/i, '');
    const text = withoutUnit.replace(/[_-]+/g, ' ').trim();
    return text ? `${text[0]!.toUpperCase()}${text.slice(1)}` : 'Value';
};

const normalizeCell = (value: unknown, columnName: string): DatasetQueryCell =>
{
    if (value === null) return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number')
    {
        if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))
        {
            throw new DatasetQueryError('SQL_RESULT_LIMIT', 'The query returned an unsupported numeric value.');
        }
        return /_eur$/i.test(columnName) ? Math.round(value * 100) / 100 : value;
    }
    if (typeof value === 'bigint')
    {
        if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER))
        {
            throw new DatasetQueryError('SQL_RESULT_LIMIT', 'The query returned an integer outside the safe range.');
        }
        return Number(value);
    }
    if (typeof value === 'string')
    {
        if (value.length > MAX_CELL_CHARACTERS)
        {
            throw new DatasetQueryError('SQL_RESULT_LIMIT', `Text cells are limited to ${MAX_CELL_CHARACTERS} characters.`);
        }
        return value;
    }
    throw new DatasetQueryError('SQL_RESULT_LIMIT', 'The query returned an unsupported value such as binary data.');
};

const columnKind = (values: DatasetQueryCell[]): DatasetColumnKind =>
{
    const populated = values.filter((value) => value !== null);
    if (populated.length === 0) return 'null';
    if (populated.every((value) => typeof value === 'number')) return 'number';
    if (populated.every((value) => typeof value === 'boolean')) return 'boolean';
    return 'text';
};

const normalizeResult = (
    response: Extract<QueryWorkerResponse, {ok: true}>
): Omit<DatasetQueryResult, 'queryHash'> =>
{
    if (response.columnNames.length === 0 || response.columnNames.length > MAX_COLUMNS)
    {
        throw new DatasetQueryError('SQL_RESULT_LIMIT', `Results must contain between 1 and ${MAX_COLUMNS} columns.`);
    }
    const normalizedNames = response.columnNames.map((name) => name.trim().toLowerCase());
    if (new Set(normalizedNames).size !== normalizedNames.length)
    {
        throw new DatasetQueryError('SQL_INVALID', 'Every selected column must have a unique alias.');
    }

    const truncated = response.values.length > MAX_ROWS;
    const values = response.values.slice(0, MAX_ROWS).map((row) =>
    {
        if (row.length !== response.columnNames.length)
        {
            throw new DatasetQueryError('SQL_INTERNAL', 'SQLite returned an inconsistent result shape.');
        }
        return row.map((cell, index) => normalizeCell(cell, response.columnNames[index]!));
    });
    const columns: DatasetQueryColumn[] = response.columnNames.map((name, index) => ({
        key: `c${index}`,
        name,
        label: humanize(name),
        kind: columnKind(values.map((row) => row[index] ?? null))
    }));
    const rows = values.map((row) => Object.fromEntries(columns.map((column, index) => [column.key, row[index] ?? null])));
    if (JSON.stringify({columns, rows}).length > MAX_RESULT_BYTES)
    {
        throw new DatasetQueryError('SQL_RESULT_LIMIT', 'The query result is too large; aggregate or narrow it.');
    }
    return {columns, rows, returnedRowCount: rows.length, truncated};
};

const executeDatasetQuery = async (
    canonicalSql: string,
    parameters: DatasetQueryParameter[],
    options: DataLayerOptions
): Promise<DatasetQueryResult> =>
{
    const {databasePath} = ensureDemoDatabase(options);
    const response = await runCanonicalDatasetQuery({
        databasePath,
        sql: canonicalSql,
        rowLimit: MAX_ROWS,
        ...parameters.length > 0 && {parameters}
    });
    if (!response.ok)
    {
        throw new DatasetQueryError(response.code, response.message);
    }
    return {
        ...normalizeResult(response),
        queryHash: createHash('sha256')
            .update(canonicalSql)
            .update('\0')
            .update(JSON.stringify(parameters))
            .digest('hex')
    };
};

export const queryDataset = async (sql: string, options: DataLayerOptions = {}): Promise<DatasetQueryResult> =>
    executeDatasetQuery(canonicalizeDatasetQuery(sql), [], options);

export const queryParameterizedDataset = async (
    sql: string,
    parameters: DatasetQueryParameter[],
    options: DataLayerOptions = {}
): Promise<DatasetQueryResult> =>
{
    if (parameters.length > MAX_PARAMETERS)
    {
        throw new DatasetQueryError('SQL_POLICY', `Compiled queries support at most ${MAX_PARAMETERS} parameters.`);
    }
    if (parameters.some((value) => value !== null
        && typeof value !== 'string'
        && (typeof value !== 'number' || !Number.isFinite(value))))
    {
        throw new DatasetQueryError('SQL_POLICY', 'Compiled query parameters must be finite numbers, strings, or null.');
    }
    const canonicalSql = canonicalizeDatasetQuery(sql, {allowParameters: true});
    return executeDatasetQuery(canonicalSql, parameters, options);
};
