import {afterAll, expect, test} from 'bun:test';
import {resolve} from 'node:path';
import type {SocketData} from '../core/types.ts';
import {createDocsHandler} from '../routes/docs/[...slug].ts';
import {currentDocumentation, verifyDocumentation} from './documentation.ts';

const root = resolve(import.meta.dir, '../..');
const documents = currentDocumentation(root);
test('current docs match real commands, links, domain catalogs and feature flags', () =>
{
    expect(verifyDocumentation(root, documents)).toEqual([]);
});
test('documentation checker catches wrong commands, broken served links, omitted tools and unknown table entries', () =>
{
    const changed = {...documents, 'public/docs/readme.md': `${documents['public/docs/readme.md']!
        .replace(/^\| `get_order` .*\n/m, '')}\n| \`imaginary_tool\` | fake | fake |\n`,
    'README.md': `${documents['README.md']}\nbun run missing-script\n[broken](/docs/not-a-page)\n`};
    const errors = verifyDocumentation(root, changed);
    expect(errors).toContain('README.md: unknown Bun command missing-script');
    expect(errors).toContain('README.md: missing link /docs/not-a-page');
    expect(errors).toContain('public/docs/readme.md: domain tool catalog drift');
});
test('feature omissions are found across current served pages without rewriting historical evidence', () =>
{
    const changed = Object.fromEntries(Object.entries(documents).map(([path, text]) => [path, text.replaceAll('NLUI_INFOGRAPHICS=1', 'obsolete-opt-in')]));
    expect(verifyDocumentation(root, changed)).toContain('public/docs: missing feature NLUI_INFOGRAPHICS');
    expect(Object.keys(documents).some((path) => path.includes('/reviews/'))).toBeFalse();
});

const handler = createDocsHandler(resolve(root, 'public/docs'));
const server = Bun.serve({hostname: '127.0.0.1', port: 0, fetch: async (req, server) =>
    await handler({req, server: server as unknown as Bun.Server<SocketData>, pathname: new URL(req.url).pathname,
        params: {slug: new URL(req.url).pathname.slice(6)}, query: {}}) ?? new Response(null, {status: 404})});
afterAll(async () => {await server.stop(true);});
test('all maintained public guides render through the real contained Markdown handler', async () =>
{
    for (const path of Object.keys(documents).filter((path) => path.startsWith('public/docs/')))
    {
        const response = await fetch(new URL(`/docs/${path.slice(12, -3)}`, server.url));
        const html = await response.text();
        expect(response.status, path).toBe(200); expect(response.headers.get('content-type')).toContain('text/html');
        expect(html).toContain('<h1'); expect(html).not.toContain('uses stored responses for conversation chaining');
    }
});
