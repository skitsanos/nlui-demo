import {copyFile, cp, mkdir, mkdtemp, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {prepareHttpFileFixtures} from './http-file-fixtures.ts';
import {probeOwnedSessions} from './http-session-probe.ts';

const projectRoot = resolve(import.meta.dir, '..');

const withTimeout = async <T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> =>
{
    let timer: ReturnType<typeof setTimeout>;
    try
    {
        return await Promise.race([
            promise,
            new Promise<never>((_resolve, reject) => {timer = setTimeout(() => reject(new Error(message)), milliseconds);})
        ]);
    }
    finally
    {
        clearTimeout(timer!);
    }
};

const waitForUrl = (output: ReadableStream<Uint8Array>): Promise<string> =>
    new Promise((ready, reject) =>
    {
        // Keep consuming the same stream after startup; a broken pipe or a full
        // log buffer must not interrupt the test server. Retain only a small tail.
        void (async () =>
        {
            let tail = '';
            for await (const chunk of output)
            {
                tail = (tail + new TextDecoder().decode(chunk)).slice(-8_000);
                const match = tail.match(/Server started at (http:\/\/[^\s"}]+)/);
                if (match) ready(match[1].replace('0.0.0.0', '127.0.0.1').replace(/\/$/, ''));
            }
            reject(new Error('Smoke server exited before becoming ready'));
        })().catch(reject);
    });

const drain = async (stream: ReadableStream<Uint8Array>): Promise<void> =>
{
    for await (const _chunk of stream) { /* Discard private diagnostics. */ }
};

export const runHttpSmoke = async (options: {
    compiledBinary?: string; hurlFile?: string; temporaryParent?: string; quiet?: boolean
} = {}): Promise<void> =>
{
    const hurl = Bun.which('hurl');
    if (!hurl) throw new Error('Install Hurl to run HTTP smoke tests: https://hurl.dev/docs/installation.html');
    const compiledBinary = options.compiledBinary ? resolve(options.compiledBinary) : undefined;
    const hurlFile = resolve(options.hurlFile ?? join(projectRoot, 'tests', 'http-smoke.hurl'));
    // Every writable artifact and the server CWD belong to this unique fixture.
    // Cleanup never targets the caller's random_file, uploads/, or database.
    const fixtureRoot = await mkdtemp(join(options.temporaryParent ?? tmpdir(), 'nlui-http-smoke-'));
    let server: Bun.Subprocess<'ignore', 'pipe', 'pipe'> | undefined;
    let requests: Bun.Subprocess | undefined;
    try
    {
        // Copy source/assets so both runtime modes resolve their public root
        // inside this owned fixture, not back into the developer's checkout.
        for (const name of ['src', 'public'])
        {
            await cp(join(projectRoot, name), join(fixtureRoot, name), {recursive: true});
        }
        for (const name of ['node_modules'])
        {
            await symlink(join(projectRoot, name), join(fixtureRoot, name), process.platform === 'win32' ? 'junction' : undefined);
        }
        for (const name of ['package.json', 'tsconfig.json'])
        {
            await copyFile(join(projectRoot, name), join(fixtureRoot, name));
        }
        await mkdir(join(fixtureRoot, 'data'), {recursive: true});
        await copyFile(join(projectRoot, 'data', 'fixture-manifest.json'), join(fixtureRoot, 'data', 'fixture-manifest.json'));
        await cp(join(projectRoot, 'data', 'knowledge'), join(fixtureRoot, 'data', 'knowledge'), {recursive: true});
        await prepareHttpFileFixtures(fixtureRoot);
        const uploadFixture = join(fixtureRoot, 'upload-fixture.bin');
        await writeFile(uploadFixture, new Uint8Array(8 * 1024 * 1024));
        server = Bun.spawn(compiledBinary ? [compiledBinary] : [process.execPath, join(fixtureRoot, 'src', 'index.ts')], {
            cwd: fixtureRoot,
            env: {...process.env, OPENAI_API_KEY: '', CHAT_MODEL: '', NLUI_EVAL_LIVE: '0', PORT: '0', NODE_ENV: 'production', LOG_LEVEL: 'INFO', NLUI_STATE_DB_PATH: join(fixtureRoot, 'data', 'conversations.sqlite')},
            stdin: 'ignore', stdout: 'pipe', stderr: 'pipe'
        });
        // Drain stderr without exposing runtime diagnostics or credentials.
        void drain(server.stderr).catch(() => undefined);
        const url = await withTimeout(waitForUrl(server.stdout), 30_000, 'Smoke server startup timed out');
        requests = Bun.spawn([hurl, '--test', '--file-root', fixtureRoot, '--variable', `base_url=${url}`,
            '--variable', 'upload_fixture=upload-fixture.bin', hurlFile], {
            cwd: fixtureRoot, stdin: 'ignore', stdout: options.quiet ? 'ignore' : 'inherit',
            stderr: options.quiet ? 'ignore' : 'inherit'
        });
        const code = await withTimeout(requests.exited, 30_000, 'HTTP smoke requests timed out');
        if (code !== 0) throw new Error(`HTTP smoke tests failed with exit code ${code}`);
        await probeOwnedSessions(url);
        if (!options.quiet) console.log(`HTTP smoke passed (${compiledBinary ? 'compiled' : 'source'}); isolated fixtures will be removed.`);
    }
    finally
    {
        if (requests && requests.exitCode === null)
        {
            requests.kill();
            await requests.exited;
        }
        if (server)
        {
            server.kill();
            try
            {
                await withTimeout(server.exited, 2_000, 'Smoke server shutdown timed out');
            }
            catch
            {
                server.kill('SIGKILL');
                await server.exited;
            }
        }
        await rm(fixtureRoot, {recursive: true, force: true});
    }
};

if (import.meta.main)
{
    const compiledIndex = process.argv.indexOf('--compiled');
    if (compiledIndex !== -1 && !process.argv[compiledIndex + 1]) throw new Error('--compiled requires a binary path');
    await runHttpSmoke({compiledBinary: compiledIndex === -1 ? undefined : process.argv[compiledIndex + 1]});
}
