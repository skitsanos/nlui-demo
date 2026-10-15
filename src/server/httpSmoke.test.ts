import {afterEach, describe, expect, test} from 'bun:test';
import {mkdir, mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runHttpSmoke} from '../../scripts/smoke-http.ts';

const directories: string[] = [];
afterEach(async () =>
{
    await Promise.all(directories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})));
});

describe.skipIf(!Bun.which('hurl'))('owned HTTP smoke cleanup', () =>
{
    test.each([false, true])('preserves unrelated uploads and fixtures (request failure: %s)', async (fail) =>
    {
        const directory = await mkdtemp(join(tmpdir(), 'nlui-smoke-cleanup-test-'));
        directories.push(directory);
        await mkdir(join(directory, 'uploads'));
        await writeFile(join(directory, 'uploads', 'retained.txt'), 'retained upload');
        await writeFile(join(directory, 'random_file'), 'retained fixture');
        const hurlFile = join(directory, 'probe.hurl');
        await writeFile(hurlFile, `POST {{base_url}}/api/upload\n[MultipartFormData]\n`
            + 'file: file,{{upload_fixture}}; application/octet-stream\nHTTP 200\n\n'
            + `GET {{base_url}}/api/health\nHTTP ${fail ? 418 : 200}\n`);
        const options = {temporaryParent: directory, hurlFile, quiet: true};
        if (fail) await expect(runHttpSmoke(options)).rejects.toThrow('HTTP smoke tests failed');
        else await runHttpSmoke(options);
        expect((await readdir(directory)).sort()).toEqual(['probe.hurl', 'random_file', 'uploads']);
        expect(await readFile(join(directory, 'random_file'), 'utf8')).toBe('retained fixture');
        expect(await readFile(join(directory, 'uploads', 'retained.txt'), 'utf8')).toBe('retained upload');
    }, 40_000);
});
