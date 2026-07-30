import {Database} from 'bun:sqlite';
import type {QueryWorkerRequest, QueryWorkerResponse} from './queryTypes.ts';

const sanitizedMessage = (error: unknown): QueryWorkerResponse =>
{
    const message = error instanceof Error ? error.message : '';
    if (/busy|locked/i.test(message))
    {
        return {ok: false, code: 'SQL_BUSY', message: 'The demo database is busy; retry the query.'};
    }
    if (/syntax|no such|ambiguous|misuse|datatype|circular|malformed/i.test(message))
    {
        const detail = message.replace(/[\r\n]/g, ' ').slice(0, 180);
        return {ok: false, code: 'SQL_INVALID', message: `SQLite rejected the query: ${detail}`};
    }
    return {ok: false, code: 'SQL_INTERNAL', message: 'The dataset query could not be completed.'};
};

self.onmessage = (event: MessageEvent<QueryWorkerRequest>): void =>
{
    const {databasePath, sql, rowLimit} = event.data;
    const database = new Database(databasePath, {readonly: true, strict: true});
    try
    {
        database.run('PRAGMA trusted_schema = OFF');
        database.run('PRAGMA busy_timeout = 250');
        database.run('PRAGMA query_only = ON');
        const statement = database.prepare(`SELECT * FROM (${sql}) AS __nlui_result LIMIT ${rowLimit + 1}`);
        if (statement.paramsCount !== 0)
        {
            postMessage({ok: false, code: 'SQL_INVALID', message: 'SQL parameters are not supported.'} satisfies QueryWorkerResponse);
            return;
        }
        const columnNames = [...statement.columnNames];
        const values = statement.values() as unknown[][];
        postMessage({ok: true, columnNames, values} satisfies QueryWorkerResponse);
    }
    catch (error)
    {
        postMessage(sanitizedMessage(error));
    }
    finally
    {
        database.close();
    }
};
