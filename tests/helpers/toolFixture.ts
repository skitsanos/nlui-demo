import {afterAll, beforeAll} from 'bun:test';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDemoRepository, resetDemoDatabase} from '../../src/data/index.ts';
import {executeNluiTool} from '../../src/nlui/tools.ts';
import type {ToolDataSource} from '../../src/nlui/toolTypes.ts';

export const isolatedToolFixture = () =>
{
    let directory: string;
    let data: ToolDataSource;
    beforeAll(() =>
    {
        directory = mkdtempSync(join(tmpdir(), 'nlui-tool-fixture-'));
        const databasePath = join(directory, 'demo.sqlite');
        resetDemoDatabase({databasePath});
        data = {databasePath, repository: createDemoRepository({databasePath})};
    });
    afterAll(() =>
    {
        data?.repository.close();
        if (directory) rmSync(directory, {recursive: true, force: true});
    });
    return (name: string, args: string, signal?: AbortSignal) => executeNluiTool(name, args, signal, data);
};
