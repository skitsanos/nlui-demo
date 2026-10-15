import {mkdir, symlink, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

/** Call only with an owned temporary application/container root, never the repo. */
export const prepareHttpFileFixtures = async (root: string): Promise<void> =>
{
    const publicDir = join(root, 'public');
    const docsDir = join(publicDir, 'docs');
    const sibling = join(root, 'public-private');
    await mkdir(docsDir, {recursive: true});
    await writeFile(join(root, 'monthly-region.csv'), 'month,region,revenue_eur,order_count\n2026-06,West,1234.50,12\n2026-06,East,987.25,9\n');
    await mkdir(join(root, 'config'), {recursive: true});
    await writeFile(join(root, 'config/server.yaml'), 'server:\n  cors:\n    enabled: true\n    allowedOrigins: ["https://allowed.example"]\n    allowedMethods: [GET, HEAD, POST, DELETE, OPTIONS]\n    allowedHeaders: [Content-Type, Authorization]\n');
    await writeFile(join(root, 'src/routes/api/cors-options.ts'),
        'let mutations = 0; export const GET = () => Response.json({mutations});\n'
        + 'export const POST = () => {mutations++; return Response.json({mutations});};\n'
        + 'export const OPTIONS = () => new Response("Ordinary OPTIONS", {status: 202, headers: {Vary: "Accept-Encoding"}});\n');
    await mkdir(sibling);
    await mkdir(join(publicDir, 'boundary-folder.txt'));
    await mkdir(join(docsDir, 'boundary-folder.md'));
    await writeFile(join(publicDir, 'boundary-safe.txt'), 'static boundary fixture');
    await writeFile(join(publicDir, 'boundary style.css'), 'body { color: black; }');
    await writeFile(join(docsDir, 'boundary-safe.md'), '# Safe boundary documentation');
    await writeFile(join(root, 'private-fixture.md'), 'PRIVATE_BOUNDARY_SENTINEL');
    await writeFile(join(sibling, 'sentinel.txt'), 'PRIVATE_BOUNDARY_SENTINEL');
    await writeFile(join(sibling, 'private-fixture.md'), 'PRIVATE_BOUNDARY_SENTINEL');
    for (const [destination, target, directory] of [
        [join(publicDir, 'boundary-escape.txt'), join(root, 'private-fixture.md'), false],
        // An outside sibling proves directory escape without a root-discovery cycle.
        [join(publicDir, 'boundary-directory'), sibling, true],
        [join(publicDir, 'boundary-sibling.txt'), join(sibling, 'sentinel.txt'), false],
        [join(docsDir, 'boundary-escape.md'), join(root, 'private-fixture.md'), false],
        [join(docsDir, 'boundary-public.md'), join(publicDir, 'boundary-safe.txt'), false],
        [join(docsDir, 'boundary-directory'), sibling, true]
    ] as const)
    {
        await symlink(target, destination, process.platform === 'win32' ? (directory ? 'junction' : 'file') : undefined);
    }
};
