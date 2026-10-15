import {Database} from 'bun:sqlite';
import type {QueryWorkerRequest, QueryWorkerResponse} from './queryTypes.ts';

const sanitizedMessage = (error: unknown): QueryWorkerResponse =>
{
    const message = error instanceof Error ? error.message : '';
    if (/busy|locked/i.test(message))
        return {ok: false, code: 'SQL_BUSY', message: 'The demo database is busy; retry the query.'};
    if (/syntax|no such|ambiguous|misuse|datatype|circular|malformed/i.test(message))
        return {ok: false, code: 'SQL_INVALID', message: `SQLite rejected the query: ${message.replace(/[\r\n]/g, ' ').slice(0, 180)}`};
    return {ok: false, code: 'SQL_INTERNAL', message: 'The dataset query could not be completed.'};
};

type QueryConnection = Pick<Database, 'run' | 'prepare' | 'close'>;
// Returning only after finally closes the connection prevents the parent from
// terminating a worker during SQLite cleanup or racing its last-reader lock.
export const executeWorkerQuery = ({databasePath, sql, rowLimit, parameters = []}: QueryWorkerRequest,
    open: (path: string) => QueryConnection = (path) => new Database(path, {readonly: true, strict: true})): QueryWorkerResponse =>
{
    const database = open(databasePath);
    try
    {
        database.run('PRAGMA trusted_schema = OFF');
        database.run('PRAGMA busy_timeout = 250');
        database.run('PRAGMA query_only = ON');
        const statement = database.prepare(`SELECT * FROM (${sql}) AS __nlui_result LIMIT ${rowLimit + 1}`);
        if (statement.paramsCount !== parameters.length)
            return {ok: false, code: 'SQL_INVALID', message: 'SQL parameter values did not match the compiled query.'};
        return {ok: true, columnNames: [...statement.columnNames], values: statement.values(...parameters) as unknown[][]};
    }
    catch (error) {return sanitizedMessage(error);}
    finally {database.close();}
};
