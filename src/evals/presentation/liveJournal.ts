import {closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {type EvaluationRedactionConfig, redactConfiguredValues } from '../reportRedaction.ts';

// Immutable per-attempt files plus a process lock; a reservation without a result is never silently retried.
export class SelectionJournal
{
    private lock: number | undefined;
    constructor(readonly root: string, private readonly redaction: EvaluationRedactionConfig)
    {
        if (existsSync(root) && (lstatSync(root).isSymbolicLink() || !lstatSync(root).isDirectory())) throw new Error('Invalid pilot directory.');
        mkdirSync(root, {recursive: true, mode: 0o700});
        this.lock = openSync(join(root, 'pilot.lock'), 'wx', 0o600);
        writeFileSync(this.lock, String(process.pid)); fsyncSync(this.lock);
    }
    write(name: string, value: unknown): void
    {
        if (!/^[a-z0-9-]+\.json$/.test(name)) throw new Error('Invalid journal filename.');
        const fd = openSync(join(this.root, name), 'wx', 0o600);
        try {writeFileSync(fd, `${JSON.stringify(this.sanitize(value), null, 2)}\n`); fsyncSync(fd);}
        finally {closeSync(fd);}
    }
    sanitize(value: unknown): unknown {return redactConfiguredValues(value, this.redaction);}
    read<T>(name: string): T | undefined
    {
        if (!/^[a-z0-9-]+\.json$/.test(name)) throw new Error('Invalid journal filename.');
        const path = join(this.root, name);
        if (!existsSync(path)) return undefined;
        if (lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile()) throw new Error('Invalid journal file.');
        return JSON.parse(readFileSync(path, 'utf8')) as T;
    }
    bind(manifest: unknown): void
    {
        const existing = this.read('manifest.json');
        const safe = redactConfiguredValues(manifest, this.redaction);
        if (existing && !isDeepStrictEqual(existing, safe)) throw new Error('Pilot manifest changed; this approval cannot be silently reused.');
        if (!existing) this.write('manifest.json', safe);
    }
    close(): void
    {
        if (this.lock !== undefined) {closeSync(this.lock); this.lock = undefined; unlinkSync(join(this.root, 'pilot.lock'));}
    }
}
