import {describe, expect, test} from 'bun:test';
import {resolve} from 'node:path';

const project = resolve(import.meta.dir, '../..');
const dockerfile = await Bun.file(resolve(project, 'Dockerfile')).text();
const ignored = await Bun.file(resolve(project, '.dockerignore')).text();
const patterns = new Set(ignored.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#')));

describe('production image input contract', () =>
{
    test('uses current Bun, frozen production dependencies, non-root runtime and port-aware health', () =>
    {
        expect(dockerfile).toContain('FROM oven/bun:latest AS base');
        expect(dockerfile).toContain('bun install --frozen-lockfile --production');
        expect(dockerfile).toMatch(/^USER bun$/m);
        expect(dockerfile).toContain('process.env.PORT??3000');
        expect(dockerfile).toContain('chown -R bun:bun /app/uploads /app/data');
        expect(dockerfile).not.toMatch(/^COPY\s+\.\s/m);
    });
    test('excludes credentials, retained data, tests, reports and CI from the build context', () =>
    {
        for (const pattern of ['.env*', '.npmrc*', '*.pem', '*.key', '.git', '.github', 'data/*.sqlite',
            'data/*.sqlite-wal', 'data/*.sqlite-shm', 'uploads', 'eval-results', 'tests', 'docs/issues',
            'src/**/*.test.ts', 'src/**/*.test.tsx', 'dist']) expect(patterns.has(pattern)).toBeTrue();
        expect([...patterns].some((pattern) => pattern.startsWith('!'))).toBeFalse();
    });
});
