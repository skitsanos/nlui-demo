export interface QualificationCommand
{
    command: string[];
    cwd?: string;
    timeoutMs?: number;
    capture?: boolean;
    allowFailure?: boolean;
    cleanup?: boolean;
}
export type QualificationRunner = (options: QualificationCommand) => Promise<{code: number; stdout: string}>;

export const qualificationEnvironment = (environment: NodeJS.ProcessEnv): Record<string, string> =>
    Object.fromEntries(Object.entries({...environment, OPENAI_API_KEY: '', CHAT_MODEL: '', NLUI_EVAL_LIVE: '0'})
        .filter(([key, value]) => value !== undefined && (!key.startsWith('OPENAI_') || key === 'OPENAI_API_KEY')));

// Never forward provider configuration or echo captured diagnostics. The CLI also
// disables dotenv loading; ordinary development and the ignored .env stay intact.
export const createQualificationRunner = (signal?: AbortSignal): QualificationRunner => async (options) =>
{
    const child = Bun.spawn(options.command, {cwd: options.cwd, env: qualificationEnvironment(process.env),
        detached: process.platform !== 'win32',
        stdin: 'ignore', stdout: options.capture ? 'pipe' : 'inherit', stderr: options.capture ? 'pipe' : 'inherit'});
    const abort = () =>
    {
        try
        {
            // Include subprocesses such as `bun run check`'s test runner.
            if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL');
            else child.kill('SIGKILL');
        }
        catch {if (child.exitCode === null) child.kill('SIGKILL');}
    };
    if (!options.cleanup)
    {
        signal?.addEventListener('abort', abort, {once: true});
        if (signal?.aborted) abort();
    }
    let timedOut = false;
    const timer = setTimeout(() => {timedOut = true; abort();}, options.timeoutMs ?? 60_000);
    try
    {
        const [code, stdout] = await Promise.all([child.exited,
            child.stdout instanceof ReadableStream ? new Response(child.stdout).text() : Promise.resolve(''),
            child.stderr instanceof ReadableStream ? new Response(child.stderr).text() : Promise.resolve('')]);
        if (timedOut || (!options.cleanup && signal?.aborted)) throw new Error('Qualification command cancelled or timed out');
        if (code !== 0 && !options.allowFailure) throw new Error(`Qualification command failed (exit ${code}); captured diagnostics withheld`);
        return {code, stdout};
    }
    finally
    {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        if (child.exitCode === null) {abort(); await child.exited;}
    }
};
