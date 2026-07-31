import {Database} from 'bun:sqlite';
import {createHash} from 'node:crypto';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DEFAULT_DATABASE_PATH, ensureDemoDatabase, resetDemoDatabase} from '../data/index.ts';

const FINGERPRINT_TABLES = [
    'activity_log',
    'customers',
    'dataset_metadata',
    'order_items',
    'orders',
    'payments',
    'pending_actions',
    'policy_documents',
    'products',
    'returns',
    'shipments',
    'support_cases'
] as const;

export interface EvaluationDatasetState
{
    fingerprint: string;
    baselineFingerprint: string;
    isBaseline: boolean;
}

const fingerprintDatabase = (databasePath: string): string =>
{
    const database = new Database(databasePath, {readonly: true, strict: true});
    const hash = createHash('sha256');
    try
    {
        for (const table of FINGERPRINT_TABLES)
        {
            const rows = database.query(`SELECT * FROM ${table} ORDER BY rowid`).all();
            hash.update(table);
            hash.update(JSON.stringify(rows));
        }
        return hash.digest('hex');
    }
    finally
    {
        database.close();
    }
};

export const inspectEvaluationDataset = (databasePath = DEFAULT_DATABASE_PATH): EvaluationDatasetState =>
{
    ensureDemoDatabase({databasePath});
    const baselineDirectory = mkdtempSync(join(tmpdir(), 'nlui-eval-baseline-'));
    const baselinePath = join(baselineDirectory, 'demo.sqlite');
    try
    {
        resetDemoDatabase({databasePath: baselinePath});
        const fingerprint = fingerprintDatabase(databasePath);
        const baselineFingerprint = fingerprintDatabase(baselinePath);
        return {fingerprint, baselineFingerprint, isBaseline: fingerprint === baselineFingerprint};
    }
    finally
    {
        rmSync(baselineDirectory, {recursive: true, force: true});
    }
};
