export type DatasetQueryCell = string | number | boolean | null;

export type DatasetColumnKind = 'boolean' | 'null' | 'number' | 'text';

export interface DatasetQueryColumn
{
    key: string;
    name: string;
    label: string;
    kind: DatasetColumnKind;
}

export interface DatasetQueryResult
{
    queryHash: string;
    columns: DatasetQueryColumn[];
    rows: Array<Record<string, DatasetQueryCell>>;
    returnedRowCount: number;
    truncated: boolean;
}

export type DatasetQueryParameter = string | number | null;

export interface QueryWorkerRequest
{
    databasePath: string;
    sql: string;
    rowLimit: number;
    parameters?: DatasetQueryParameter[];
}

export type QueryWorkerResponse =
    | {ok: true; columnNames: string[]; values: unknown[][]}
    | {ok: false; code: 'SQL_BUSY' | 'SQL_INVALID' | 'SQL_INTERNAL'; message: string};

export type DatasetQueryErrorCode =
    | 'SQL_BUSY'
    | 'SQL_INTERNAL'
    | 'SQL_INVALID'
    | 'SQL_POLICY'
    | 'SQL_RESULT_LIMIT'
    | 'SQL_TIMEOUT';

export class DatasetQueryError extends Error
{
    readonly code: DatasetQueryErrorCode;

    constructor(code: DatasetQueryErrorCode, message: string)
    {
        super(`${code}: ${message}`);
        this.name = 'DatasetQueryError';
        this.code = code;
    }
}
