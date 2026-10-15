import {Database} from 'bun:sqlite';
import {createHash} from 'node:crypto';
import {chmodSync, mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import type {ChatInput, ChatStreamEvent} from '../nlui/types.ts';
import {publicChatStreamEvent} from '../services/publicChatStream.ts';

export class ConversationAccessError extends Error
{
    constructor(readonly status = 404, message = 'Conversation not found.') {super(message);}
}

export interface StoredEvent
{
    version: 1;
    sequence: number;
    requestId: string;
    event: ChatStreamEvent | {type: 'user.input'; input: ChatInput; displayText?: string};
}

const schema = `
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, owner TEXT NOT NULL, head TEXT);
CREATE TABLE IF NOT EXISTS turns (conversation TEXT NOT NULL, id TEXT NOT NULL, digest TEXT NOT NULL,
 status TEXT NOT NULL, lease INTEGER NOT NULL, PRIMARY KEY(conversation,id));
CREATE TABLE IF NOT EXISTS events (conversation TEXT NOT NULL, sequence INTEGER NOT NULL,
 request_id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(conversation,sequence));
CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, conversation TEXT NOT NULL,
 body TEXT NOT NULL, PRIMARY KEY(kind,id));
CREATE INDEX IF NOT EXISTS events_turn ON events(conversation,request_id);
CREATE INDEX IF NOT EXISTS records_conversation ON records(conversation,kind);
`;
const digest = (value: string): string => createHash('sha256').update(value).digest('hex');

// Application state is deliberately separate from the versioned analytical fixture.
export class ConversationStore
{
    readonly database: Database;
    constructor(path: string, private readonly now = Date.now)
    {
        if (path !== ':memory:') mkdirSync(dirname(path), {recursive: true, mode: 0o700});
        this.database = new Database(path, {create: true, strict: true});
        try
        {
            const version = this.database.query<{user_version: number}, []>('PRAGMA user_version').get()!.user_version;
            const tables = this.database.query<{name: string}, []>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
            const owned = new Set(['sessions', 'conversations', 'turns', 'events', 'records']);
            if (version > 1 || tables.some(({name}) => !owned.has(name)) || tables.length > 0 && tables.length !== owned.size)
                throw new Error('Refusing to modify an unknown application-state database.');
            if (path !== ':memory:') chmodSync(path, 0o600);
            this.database.run('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
            this.database.run(schema);
            if (version === 0) this.database.run('PRAGMA user_version=1');
            // Single-process demo: a previous process cannot still own its turns.
            this.database.run("UPDATE turns SET status='interrupted' WHERE status='running'");
        }
        catch (error) {this.database.close(); throw error;}
    }

    session(token?: string): {owner: string; token?: string}
    {
        const owner = token && /^[a-f0-9]{64}$/.test(token) ? digest(token) : '';
        const row = this.database.query<{expires: number}, [string]>('SELECT expires FROM sessions WHERE id=?').get(owner);
        if (row && row.expires > this.now()) return {owner};
        if (this.database.query<{n: number}, []>('SELECT COUNT(*) n FROM sessions').get()!.n >= 1000)
            throw new ConversationAccessError(429, 'The local session limit was reached.');
        const fresh = crypto.getRandomValues(new Uint8Array(32)).toHex();
        const id = digest(fresh);
        this.database.query('INSERT INTO sessions VALUES (?,?)').run(id, this.now() + 7 * 86400_000);
        return {owner: id, token: fresh};
    }

    assertOwner(owner: string, conversation: string): void
    {
        const row = this.database.query<{owner: string}, [string]>('SELECT owner FROM conversations WHERE id=?').get(conversation);
        if (!row || row.owner !== owner) throw new ConversationAccessError();
    }

    begin(owner: string, conversation: string, requestId: string, input: ChatInput, previous?: string, displayText?: string): 'new' | 'replay'
    {
        return this.database.transaction(() =>
        {
            const row = this.database.query<{owner: string; head: string | null}, [string]>(
                'SELECT owner,head FROM conversations WHERE id=?').get(conversation);
            if (row && row.owner !== owner) throw new ConversationAccessError();
            if (!row)
            {
                if (previous) throw new ConversationAccessError(409, 'The conversation cursor is stale. Reload its history.');
                const count = this.database.query<{n: number}, [string]>('SELECT COUNT(*) n FROM conversations WHERE owner=?').get(owner)!.n;
                if (count >= 20) throw new ConversationAccessError(429, 'The local session conversation limit was reached.');
                this.database.query('INSERT INTO conversations(id,owner) VALUES (?,?)').run(conversation, owner);
            }
            const hash = digest(JSON.stringify(input));
            const existing = this.database.query<{digest: string; status: string}, [string, string]>(
                'SELECT digest,status FROM turns WHERE conversation=? AND id=?').get(conversation, requestId);
            if (existing)
            {
                if (existing.digest !== hash) throw new ConversationAccessError(409, 'This request identifier was already used for different input.');
                if (existing.status === 'complete' || existing.status === 'interrupted') return 'replay';
                throw new ConversationAccessError(409, 'This turn is still running. Reconnect to its history.');
            }
            if ((row?.head ?? undefined) !== previous) throw new ConversationAccessError(409, 'The conversation cursor is stale. Reload its history.');
            this.database.query("UPDATE turns SET status='interrupted' WHERE status='running' AND lease<=?").run(this.now());
            const running = this.database.query<{n: number}, []>("SELECT COUNT(*) n FROM turns WHERE status='running'").get()!.n;
            const busy = this.database.query<{n: number}, [string]>(
                "SELECT COUNT(*) n FROM turns WHERE conversation=? AND status='running'").get(conversation)!.n;
            const ownerBusy = this.database.query<{n: number}, [string]>(
                "SELECT COUNT(*) n FROM turns t JOIN conversations c ON t.conversation=c.id WHERE c.owner=? AND t.status='running'").get(owner)!.n;
            const count = this.database.query<{n: number}, [string]>('SELECT COUNT(*) n FROM turns WHERE conversation=?').get(conversation)!.n;
            if (busy || running >= 8 || ownerBusy >= 2 || count >= 200) throw new ConversationAccessError(429, 'The local conversation budget was reached.');
            this.database.query("INSERT INTO turns VALUES (?,?,?,'running',?)").run(conversation, requestId, hash, this.now() + 610_000);
            this.append(conversation, requestId, {type: 'user.input', input, ...displayText && {displayText}});
            return 'new';
        })();
    }

    append(conversation: string, requestId: string, event: StoredEvent['event']): void
    {
        const projected = event.type === 'user.input' ? event : publicChatStreamEvent(event);
        if (!projected) return;
        const body = JSON.stringify({version: 1, event: projected});
        if (body.length > 128 * 1024) throw new ConversationAccessError(413, 'The conversation event is too large.');
        this.database.transaction(() =>
        {
            this.database.query(`INSERT INTO events SELECT ?,COALESCE(MAX(sequence),0)+1,?,?
                FROM events WHERE conversation=?`).run(conversation, requestId, body, conversation);
            if (projected.type === 'message.completed')
            {
                this.database.query("UPDATE turns SET status='complete' WHERE conversation=? AND id=?").run(conversation, requestId);
                this.database.query('UPDATE conversations SET head=? WHERE id=?').run(requestId, conversation);
            }
        })();
    }

    interrupt(conversation: string, requestId: string): void
    {
        this.database.query("UPDATE turns SET status='interrupted' WHERE conversation=? AND id=? AND status='running'").run(conversation, requestId);
    }

    replay(owner: string, conversation: string, after = 0, requestId?: string): {events: StoredEvent[]; head?: string; interrupted: string[]; running: boolean; nextCursor: number; hasMore: boolean}
    {
        this.assertOwner(owner, conversation);
        const rows = this.database.query<{sequence: number; request_id: string; body: string}, [string, number]>(
            'SELECT sequence,request_id,body FROM events WHERE conversation=? AND sequence>? ORDER BY sequence LIMIT 5001').all(conversation, after);
        const head = this.database.query<{head: string | null}, [string]>('SELECT head FROM conversations WHERE id=?').get(conversation)!.head;
        const turns = this.database.query<{id: string; status: string}, [string]>('SELECT id,status FROM turns WHERE conversation=?').all(conversation);
        return {
            events: rows.slice(0, 5000).filter((row) => !requestId || row.request_id === requestId).map((row) => ({
                version: 1, sequence: row.sequence, requestId: row.request_id,
                event: (JSON.parse(row.body).version === 1 ? JSON.parse(row.body).event : JSON.parse(row.body)) as StoredEvent['event']
            })),
            ...head && {head}, interrupted: turns.filter(({status}) => status === 'interrupted').map(({id}) => id),
            running: turns.some(({status}) => status === 'running'), nextCursor: rows[Math.min(rows.length, 5000) - 1]?.sequence ?? after, hasMore: rows.length > 5000
        };
    }

    put(kind: string, id: string, conversation: string, body: unknown): void
    {
        const existing = this.database.query<{conversation: string}, [string, string]>('SELECT conversation FROM records WHERE kind=? AND id=?').get(kind, id);
        if (existing && existing.conversation !== conversation) throw new ConversationAccessError();
        this.database.query('INSERT INTO records VALUES (?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body').run(
            kind, id, conversation, JSON.stringify(body));
    }

    records<T>(kind: string, conversation?: string): Array<{id: string; conversation: string; body: T}>
    {
        const rows = this.database.query<{id: string; conversation: string; body: string}, [string, string | null, string | null]>(
            'SELECT id,conversation,body FROM records WHERE kind=? AND (? IS NULL OR conversation=?)').all(kind, conversation ?? null, conversation ?? null);
        return rows.map((row) => ({...row, body: JSON.parse(row.body) as T}));
    }

    remove(kind: string, id: string): void {this.database.query('DELETE FROM records WHERE kind=? AND id=?').run(kind, id);}
    close(): void {this.database.close();}
}

let store: ConversationStore | undefined;
export const getConversationStore = (): ConversationStore => store ??= new ConversationStore(
    resolve(process.env.NLUI_STATE_DB_PATH ?? 'data/conversations.sqlite'));
