import {afterEach, describe, expect, test} from 'bun:test';
import {mkdtemp, readdir, readFile, rm, stat, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {RouteContext} from '../core/types.ts';
import {createUploadHandler} from '../routes/api/upload.ts';
import {saveUpload} from './uploadStorage.ts';

const roots: string[] = [];
const temporaryRoot = async (): Promise<string> =>
{
    const root = await mkdtemp(join(tmpdir(), 'nlui-upload-test-'));
    roots.push(root);
    return root;
};
afterEach(async () =>
{
    await Promise.all(roots.splice(0).map((root) => rm(root, {recursive: true, force: true})));
});

const request = (body: BodyInit, contentType?: string): Request => new Request('http://localhost/api/upload', {
    method: 'POST', body, headers: contentType ? {'Content-Type': contentType} : undefined
});
const context = (req: Request): RouteContext => ({req} as RouteContext);

describe('upload safety', () =>
{
    test('simultaneous same-name uploads have unique destinations and preserve every body', async () =>
    {
        const directory = await temporaryRoot();
        const handler = createUploadHandler({directory});
        const contents = Array.from({length: 12}, (_, index) => `upload ${index}`);
        const responses = await Promise.all(contents.map(async (content) =>
        {
            const form = new FormData();
            form.set('file', new File([content], 'same.txt'));
            const response = await handler(context(request(form))) as Response;
            expect(response.status).toBe(200);
            return await response.json() as {fileName: string};
        }));
        expect(new Set(responses.map(({fileName}) => fileName)).size).toBe(contents.length);
        for (const [index, {fileName}] of responses.entries())
        {
            expect(fileName).toMatch(/^uploaded_[0-9a-f-]{36}_same.txt$/);
            expect(await readFile(join(directory, fileName), 'utf8')).toBe(contents[index]);
        }
    });

    test('collision retries never overwrite an existing file or symlink target', async () =>
    {
        const directory = await temporaryRoot();
        const sentinel = join(directory, 'sentinel.txt');
        await writeFile(sentinel, 'retained content');
        await writeFile(join(directory, 'uploaded_existing_same.txt'), 'existing upload');
        await symlink(sentinel, join(directory, 'uploaded_link_same.txt'));
        const ids = ['existing', 'link', 'unique'];
        const name = await saveUpload(new File(['new upload'], 'same.txt'), directory, () => ids.shift()!);
        expect(name).toBe('uploaded_unique_same.txt');
        expect(await readFile(sentinel, 'utf8')).toBe('retained content');
        expect(await readFile(join(directory, 'uploaded_existing_same.txt'), 'utf8')).toBe('existing upload');
        expect(await readFile(join(directory, name), 'utf8')).toBe('new upload');
        if (process.platform !== 'win32') expect((await stat(join(directory, name))).mode & 0o777).toBe(0o600);
    });

    test('collision exhaustion fails without deleting or overwriting existing content', async () =>
    {
        const directory = await temporaryRoot();
        const name = 'uploaded_same_same.txt';
        await writeFile(join(directory, name), 'retained');
        await expect(saveUpload(new File(['new'], 'same.txt'), directory, () => 'same')).rejects.toThrow('unique');
        expect(await readdir(directory)).toEqual([name]);
        expect(await readFile(join(directory, name), 'utf8')).toBe('retained');
    });

    test('removes only its own partial file on a write/read failure', async () =>
    {
        const directory = await temporaryRoot();
        await writeFile(join(directory, 'retained.txt'), 'retained');
        const file = new File(['new'], 'same.txt');
        file.arrayBuffer = async () => {throw new Error('simulated read failure');};
        await expect(saveUpload(file, directory, () => 'partial')).rejects.toThrow('simulated read failure');
        expect(await readdir(directory)).toEqual(['retained.txt']);
    });

    test.each(['../../outside.txt', '..\\..\\outside.txt', '...', '/etc/test.txt'])('sanitizes %s', async (name) =>
    {
        const directory = await temporaryRoot();
        const saved = await saveUpload(new File([new Uint8Array([0, 255, 12])], name), directory);
        expect(saved).not.toMatch(/[\\/]|\.\./);
        expect(await readFile(join(directory, saved))).toEqual(Buffer.from([0, 255, 12]));
    });

    test.each([
        ['application/json', '{}', 415],
        ['text/plain', 'hello', 415],
        ['multipart/form-data', 'no boundary', 400],
        ['multipart/form-data; boundary=missing', 'malformed body', 400]
    ])('rejects unsupported or malformed %s before filesystem writes', async (type, body, status) =>
    {
        const root = await temporaryRoot();
        const directory = join(root, 'uploads');
        const response = await createUploadHandler({directory})(context(request(body, type))) as Response;
        expect(response.status).toBe(status);
        expect((await response.json()).success).toBeFalse();
        expect(await readdir(root)).toEqual([]);
    });

    test('rejects missing or string-valued file fields', async () =>
    {
        const directory = await temporaryRoot();
        const form = new FormData();
        form.set('file', 'not a file');
        const response = await createUploadHandler({directory})(context(request(form))) as Response;
        expect(response.status).toBe(400);
        expect(await readdir(directory)).toEqual([]);
    });
});
