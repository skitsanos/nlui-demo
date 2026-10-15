import {afterEach, describe, expect, test} from 'bun:test';
import {mkdir, mkdtemp, realpath, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {containedFile, decodeFilePath} from './files.ts';

const roots: string[] = [];
afterEach(async () =>
{
    await Promise.all(roots.splice(0).map((root) => rm(root, {recursive: true, force: true})));
});

describe('canonical file containment', () =>
{
    test('allows regular internal files and canonical symlinked roots, but not outside targets', async () =>
    {
        const root = await mkdtemp(join(tmpdir(), 'nlui-file-test-'));
        roots.push(root);
        const publicDir = join(root, 'public');
        const sibling = join(root, 'public-private');
        await mkdir(publicDir);
        await mkdir(sibling);
        await writeFile(join(publicDir, 'safe.txt'), 'safe');
        await writeFile(join(sibling, 'private.txt'), 'private');
        await symlink(join(publicDir, 'safe.txt'), join(publicDir, 'internal.txt'));
        await symlink(join(sibling, 'private.txt'), join(publicDir, 'external.txt'));
        await symlink(sibling, join(publicDir, 'external-directory'));
        await symlink(publicDir, join(root, 'root-link'));
        await symlink(join(publicDir, 'missing.txt'), join(publicDir, 'dangling.txt'));
        await symlink(join(publicDir, 'loop.txt'), join(publicDir, 'loop.txt'));
        const safePath = await realpath(join(publicDir, 'safe.txt'));
        expect(await containedFile(publicDir, 'safe.txt')).toBe(safePath);
        expect(await containedFile(publicDir, 'internal.txt')).toBe(safePath);
        expect(await containedFile(join(root, 'root-link'), 'safe.txt')).toBe(safePath);
        for (const name of ['', '.', '..', '../public-private/private.txt', 'external.txt',
            'external-directory/private.txt', 'dangling.txt', 'loop.txt', 'missing.txt', '/safe.txt', 'bad\0.txt', 'dir\\safe.txt'])
        {
            expect(await containedFile(publicDir, name)).toBeNull();
        }
        expect(await containedFile(join(root, 'missing-root'), 'safe.txt')).toBeNull();
    });

    test.each(['/../private.txt', '/%2e%2e/private.txt', '/%2e/private.txt', '/dir%2fsafe.txt',
        '/dir%5csafe.txt', '/safe%00.txt', '/%ZZ', '/bad\\name.txt'])('rejects ambiguous or unsafe URL path %s', (path) =>
    {
        expect(decodeFilePath(path)).toBeNull();
    });

    test('retains benign encoded spaces, Unicode and dots within filename segments', () =>
    {
        expect(decodeFilePath('/my%20style.css')).toBe('my style.css');
        expect(decodeFilePath('/%E2%9C%93.txt')).toBe('✓.txt');
        expect(decodeFilePath('/version..txt')).toBe('version..txt');
    });
});
