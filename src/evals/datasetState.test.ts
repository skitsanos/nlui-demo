import {afterEach, describe, expect, test} from 'bun:test';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDemoRepository, resetDemoDatabase} from '../data/index.ts';
import {inspectEvaluationDataset} from './datasetState.ts';

const directories: string[] = [];
const temporaryDatabase = (): string =>
{
    const directory = mkdtempSync(join(tmpdir(), 'nlui-eval-state-test-'));
    directories.push(directory);
    return join(directory, 'demo.sqlite');
};

afterEach(() =>
{
    for (const directory of directories.splice(0)) rmSync(directory, {recursive: true, force: true});
});

describe('evaluation dataset state', () =>
{
    test('distinguishes the reproducible baseline from demo mutations', () =>
    {
        const databasePath = temporaryDatabase();
        resetDemoDatabase({databasePath});
        expect(inspectEvaluationDataset(databasePath).isBaseline).toBeTrue();

        const repository = createDemoRepository({databasePath});
        repository.prepareAction({
            type: 'cancel_order',
            orderNumber: 'ORD-1176',
            reason: 'Duplicate test order'
        });
        repository.close();
        expect(inspectEvaluationDataset(databasePath).isBaseline).toBeFalse();
    });
});
