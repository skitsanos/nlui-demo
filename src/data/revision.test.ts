import {Database} from 'bun:sqlite';
import {expect, test} from 'bun:test';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {QUERY_TABLES} from './querySchema.ts';
import {datasetRevision} from './revision.ts';

test.each([50, 2000])('revision reading handles a %i ms exclusive lock with a finite read-only wait', async (milliseconds) =>
{
    const root = mkdtempSync(join(tmpdir(), 'nlui-revision-lock-')); const path = join(root, 'demo.sqlite');
    let worker: Worker | undefined;
    try
    {
        // Start directly in rollback-journal mode: switching a seeded WAL file
        // would introduce an unrelated checkpoint/schema-lock race in setup.
        const database = new Database(path);
        try {for (const table of Object.keys(QUERY_TABLES)) database.run(`CREATE TABLE ${table}(id INTEGER PRIMARY KEY, value TEXT)`);}
        finally {database.close();}
        const expected = datasetRevision(path);
        worker = new Worker(new URL('../../tests/fixtures/sqlite-lock.ts', import.meta.url).href);
        const active = worker;
        await new Promise<void>((resolve, reject) =>
        {
            const timer = setTimeout(() => reject(new Error('Lock fixture did not start')), 3000);
            active.onmessage = () => {clearTimeout(timer); resolve();};
            active.onerror = () => {clearTimeout(timer); reject(new Error('Lock fixture failed'));};
            active.postMessage({path, milliseconds});
        });
        if (milliseconds < 250) expect(datasetRevision(path)).toBe(expected);
        else
        {
            const start = performance.now();
            expect(() => datasetRevision(path)).toThrow('locked');
            expect(performance.now() - start).toBeLessThan(1500);
        }
    }
    finally {worker?.terminate(); rmSync(root, {recursive: true, force: true});}
});
