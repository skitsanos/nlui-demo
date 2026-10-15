import {afterEach, describe, expect, test} from 'bun:test';
import {mkdir, mkdtemp, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {SocketData} from '../core/types.ts';
import {createDocsHandler} from '../routes/docs/[...slug].ts';
import Logger, {LogLevel} from '../utils/logger.ts';
import {createRequestHandler} from './requestHandler.ts';

const roots: string[] = [];
const servers: Bun.Server<SocketData>[] = [];
afterEach(async () =>
{
    for (const server of servers.splice(0)) await server.stop(true);
    await Promise.all(roots.splice(0).map((root) => rm(root, {recursive: true, force: true})));
});

const fixtureServer = async (): Promise<Bun.Server<SocketData>> =>
{
    const root = await mkdtemp(join(tmpdir(), 'nlui-file-http-test-'));
    roots.push(root);
    const publicDir = join(root, 'public');
    const docsDir = join(publicDir, 'docs');
    const siblingDir = join(root, 'public-private');
    await mkdir(docsDir, {recursive: true});
    await mkdir(siblingDir);
    await mkdir(join(publicDir, 'directory.txt'));
    await mkdir(join(docsDir, 'directory.md'));
    await writeFile(join(publicDir, 'safe.txt'), 'static boundary fixture');
    await writeFile(join(publicDir, 'my style.css'), 'body { color: black; }');
    await writeFile(join(docsDir, 'safe.md'), '# Safe documentation');
    await writeFile(join(siblingDir, 'private.txt'), 'PRIVATE_FILE_SENTINEL');
    await symlink(join(siblingDir, 'private.txt'), join(publicDir, 'escape.txt'));
    await symlink(siblingDir, join(publicDir, 'escape-directory'));
    await symlink(join(siblingDir, 'private.txt'), join(docsDir, 'escape.md'));
    await symlink(join(publicDir, 'safe.txt'), join(docsDir, 'outside-docs.md'));
    const docs = createDocsHandler(docsDir);
    const logger = new Logger('file-boundary-test', LogLevel.FATAL);
    const handler = createRequestHandler({publicDirectory: publicDir, logger, loggerHttp: logger, dispatcher: {
        preload: async () => undefined,
        websocket: {message: () => undefined},
        dispatch: async (req, server) =>
        {
            const pathname = new URL(req.url).pathname;
            if (!pathname.startsWith('/docs/')) return null;
            const response = await docs({req, server, pathname, query: {}, params: {slug: pathname.slice(6)}});
            return {matchedRoute: 'docs', upgraded: false, response};
        }
    }});
    const server = Bun.serve<SocketData>({
        hostname: '127.0.0.1', port: 0, fetch: handler, websocket: {message: () => undefined}
    });
    servers.push(server);
    return server;
};

describe('file boundaries over HTTP', () =>
{
    test('outside/sibling/directory targets never expose their sentinel contents', async () =>
    {
        const server = await fixtureServer();
        for (const path of ['/escape.txt', '/escape-directory/private.txt', '/directory.txt', '/docs/escape',
            '/docs/outside-docs', '/docs/directory', '/%2e%2e%2fpublic-private/private.txt',
            '/safe%00.txt', '/my%2fstyle.css', '/docs/%2e%2e%2fsafe', '/docs/sa%3Cfe'])
        {
            const response = await fetch(new URL(path, server.url));
            expect(response.status).toBe(404);
            expect(await response.text()).not.toContain('PRIVATE_FILE_SENTINEL');
        }
        const malformed = await fetch(new URL('/%ZZ', server.url));
        expect(malformed.status).toBe(400);
    });

    test('regular assets/docs, encoded spaces, HEAD, ETag and ranges retain behavior', async () =>
    {
        const server = await fixtureServer();
        const asset = await fetch(new URL('/safe.txt', server.url));
        expect(asset.status).toBe(200);
        expect(await asset.text()).toBe('static boundary fixture');
        expect(asset.headers.get('Content-Type')).toBe('text/plain');
        const etag = asset.headers.get('ETag')!;
        const conditional = await fetch(new URL('/safe.txt', server.url), {headers: {'If-None-Match': etag}});
        expect(conditional.status).toBe(304);
        expect(await conditional.text()).toBe('');
        const head = await fetch(new URL('/safe.txt', server.url), {method: 'HEAD'});
        expect(head.status).toBe(200);
        expect(await head.text()).toBe('');
        expect(head.headers.get('ETag')).toBe(etag);
        const range = await fetch(new URL('/safe.txt', server.url), {headers: {Range: 'bytes=0-5'}});
        expect(range.status).toBe(206);
        expect(await range.text()).toBe('static');
        const css = await fetch(new URL('/my%20style.css', server.url));
        expect(css.status).toBe(200);
        expect(css.headers.get('Content-Type')).toBe('text/css');
        await css.arrayBuffer();
        const doc = await fetch(new URL('/docs/safe', server.url));
        expect(doc.status).toBe(200);
        expect(await doc.text()).toContain('Safe documentation');
    });
});
