import {afterEach, describe, expect, test} from 'bun:test';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {queryDataset, runCanonicalDatasetQuery} from './queryDataset.ts';
import {DatasetQueryError} from './queryTypes.ts';
import {resetDemoDatabase} from './seed.ts';

const temporaryDirectories: string[] = [];

const temporaryDatabase = (): string =>
{
    const directory = mkdtempSync(join(tmpdir(), 'nlui-query-test-'));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, 'demo.sqlite');
    resetDemoDatabase({databasePath});
    return databasePath;
};

afterEach(() =>
{
    for (const directory of temporaryDirectories.splice(0))
    {
        rmSync(directory, {force: true, recursive: true});
    }
});

describe('isolated dataset queries', () =>
{
    test('returns the exact registered customer count', async () =>
    {
        const databasePath = temporaryDatabase();
        const result = await queryDataset('SELECT COUNT(*) AS customer_count FROM customers', {databasePath});

        expect(result).toMatchObject({
            returnedRowCount: 1,
            truncated: false,
            columns: [{key: 'c0', name: 'customer_count', label: 'Customer count', kind: 'number'}],
            rows: [{c0: 200}]
        });
        expect(result.queryHash).toMatch(/^[0-9a-f]{64}$/);
    });

    test('supports grouped data and stable server-owned keys', async () =>
    {
        const databasePath = temporaryDatabase();
        const result = await queryDataset(`
            SELECT tier AS label, COUNT(*) AS value
            FROM customers
            GROUP BY tier
            ORDER BY value DESC
        `, {databasePath});

        expect(result.columns.map(({key, name}) => ({key, name}))).toEqual([
            {key: 'c0', name: 'label'},
            {key: 'c1', name: 'value'}
        ]);
        expect(result.rows).toEqual([
            {c0: 'standard', c1: 140},
            {c0: 'silver', c1: 40},
            {c0: 'gold', c1: 20}
        ]);
    });

    test('caps returned rows and reports truncation', async () =>
    {
        const databasePath = temporaryDatabase();
        const result = await queryDataset('SELECT id AS customer_id FROM customers ORDER BY id', {databasePath});

        expect(result.returnedRowCount).toBe(100);
        expect(result.truncated).toBeTrue();
        expect(result.rows[0]).toEqual({c0: 1});
        expect(result.rows.at(-1)).toEqual({c0: 100});
    });

    test('terminates an overlong query without blocking the next query', async () =>
    {
        const databasePath = temporaryDatabase();
        const runaway = runCanonicalDatasetQuery({
            databasePath,
            rowLimit: 100,
            sql: 'WITH RECURSIVE x(n) AS (VALUES(1) UNION ALL SELECT n + 1 FROM x) SELECT SUM(n) AS total FROM x'
        }, 100);

        try
        {
            await runaway;
            throw new Error('Expected the query worker to time out');
        }
        catch (error)
        {
            expect(error).toBeInstanceOf(DatasetQueryError);
            expect((error as DatasetQueryError).code).toBe('SQL_TIMEOUT');
        }

        const next = await queryDataset('SELECT COUNT(*) AS customer_count FROM customers', {databasePath});
        expect(next.rows).toEqual([{c0: 200}]);
    });
});
