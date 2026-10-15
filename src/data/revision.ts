import {Database} from 'bun:sqlite';
import {createHash} from 'node:crypto';
import {DEFAULT_DATABASE_PATH} from './constants.ts';
import {QUERY_TABLES} from './querySchema.ts';

// Private rows are hashed only inside this process, never returned or logged.
export const datasetRevision = (path = DEFAULT_DATABASE_PATH): string =>
{
    const database = new Database(path, {readonly: true, strict: true});
    try
    {
        return database.transaction(() =>
        {
            const hash = createHash('sha256');
            for (const table of Object.keys(QUERY_TABLES)) hash.update(table).update('\0')
                .update(JSON.stringify(database.query(`SELECT * FROM ${table} ORDER BY id`).all())).update('\0');
            return hash.digest('hex');
        })();
    }
    finally {database.close();}
};
