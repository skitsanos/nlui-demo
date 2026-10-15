export const within = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
{
    let timer: ReturnType<typeof setTimeout>;
    try
    {
        return await Promise.race([promise, new Promise<never>((_resolve, reject) =>
        {
            timer = setTimeout(() => reject(new Error('Fixture operation exceeded its deadline')), timeoutMs);
        })]);
    }
    finally {clearTimeout(timer!);}
};

export const spawnFixture = async (command: string[], cwd: string, env: Record<string, string>) =>
{
    const child = Bun.spawn(command, {cwd, env: {...process.env, ...env}, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe'});
    let output = '';
    let error = '';
    let ready: (port: number) => void;
    let failed: (error: Error) => void;
    const port = new Promise<number>((resolve, reject) => {ready = resolve; failed = reject;});
    const drain = async (stream: ReadableStream<Uint8Array>, stderr: boolean) =>
    {
        for await (const chunk of stream)
        {
            const text = new TextDecoder().decode(chunk);
            if (stderr) error = (error + text).slice(-8_000);
            else
            {
                output = (output + text).slice(-8_000);
                const match = output.match(/FIXTURE_READY (\d+)/);
                if (match) ready(Number(match[1]));
            }
        }
    };
    const drained = Promise.all([drain(child.stdout, false), drain(child.stderr, true)]);
    void child.exited.then(() => failed(new Error('Fixture exited before startup completed')));
    try
    {
        const boundPort = await within(port, 10_000);
        return {child, url: `http://127.0.0.1:${boundPort}`,
            logs: async () => {await drained; return output;},
            stop: async () =>
            {
                if (child.exitCode === null) child.kill('SIGKILL');
                await child.exited;
                await drained;
            }};
    }
    catch
    {
        child.kill('SIGKILL');
        await child.exited;
        await drained;
        // Avoid printing environment-derived config values or arbitrary child diagnostics.
        throw new Error(`Fixture startup failed (exit ${child.exitCode}, diagnostic bytes ${error.length})`);
    }
};
