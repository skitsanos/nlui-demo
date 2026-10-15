import {Database} from 'bun:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import type {ChatRoundTrace} from '../services/chatTrace.ts';

export class ProviderRequestBudget
{
    private readonly database: Database;
    constructor(path: string, readonly maximum = 40)
    {
        if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 40) throw new Error('The approved maximum is 40 provider requests.');
        if (path !== ':memory:') mkdirSync(dirname(path), {recursive: true, mode: 0o700});
        this.database = new Database(path, {create: true, strict: true});
        this.database.run(`CREATE TABLE IF NOT EXISTS budget (id INTEGER PRIMARY KEY CHECK(id=1), maximum INTEGER NOT NULL, used INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS usage (id INTEGER PRIMARY KEY, label TEXT NOT NULL, input INTEGER, cached INTEGER, output INTEGER, total INTEGER, known INTEGER NOT NULL DEFAULT 0);
            INSERT OR IGNORE INTO budget VALUES(1,${maximum},0);`);
        const stored = this.database.query<{maximum: number}, []>('SELECT maximum FROM budget WHERE id=1').get()!;
        if (stored.maximum !== maximum) {this.database.close(); throw new Error('An existing request budget cannot be silently changed.');}
    }
    reserve(label: string): number
    {
        return this.database.transaction(() =>
        {
            const remaining = this.database.query('UPDATE budget SET used=used+1 WHERE id=1 AND used<maximum').run();
            if (remaining.changes !== 1) throw new Error('The approved provider request budget is exhausted.');
            return Number(this.database.query('INSERT INTO usage(label) VALUES(?)').run(label).lastInsertRowid);
        })();
    }
    account(id: number, round: ChatRoundTrace): void
    {
        this.database.query('UPDATE usage SET input=?,cached=?,output=?,total=?,known=? WHERE id=?').run(
            round.usage.inputTokens, round.usage.cachedInputTokens, round.usage.outputTokens, round.usage.totalTokens, round.usageKnown ? 1 : 0, id);
    }
    summary() {return this.database.query('SELECT (SELECT used FROM budget) requests, (SELECT maximum FROM budget) maximum, COUNT(*) accounted, COALESCE(SUM(input),0) inputTokens, COALESCE(SUM(cached),0) cachedTokens, COALESCE(SUM(output),0) outputTokens, COALESCE(SUM(total),0) totalTokens FROM usage WHERE known=1').get();}
    close(): void {this.database.close();}
}
