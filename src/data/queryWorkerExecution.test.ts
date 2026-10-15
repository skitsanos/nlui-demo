import type {Database} from 'bun:sqlite';
import {expect, test} from 'bun:test';
import {executeWorkerQuery} from './queryWorkerExecution.ts';

test.each(['success', 'parameters', 'busy', 'close-failure'])('worker closes before publishing %s outcome', (outcome) =>
{
    const order: string[] = [];
    const connection = {
        run() {},
        prepare: () => ({paramsCount: outcome === 'parameters' ? 1 : 0, columnNames: ['count'], values: () =>
        {
            if (outcome === 'busy') throw new Error('database is locked');
            return [[200]];
        }}),
        close: () => {order.push('closed'); if (outcome === 'close-failure') throw new Error('Close failed');}
    } as unknown as Pick<Database, 'run' | 'prepare' | 'close'>;
    const publish = () =>
    {
        const response = executeWorkerQuery({databasePath: 'unused', sql: 'SELECT 200', rowLimit: 100}, () => connection);
        order.push('published'); return response;
    };
    if (outcome === 'close-failure') {expect(publish).toThrow('Close failed'); expect(order).toEqual(['closed']); return;}
    const result = publish();
    expect(order).toEqual(['closed', 'published']);
    expect(result).toMatchObject(outcome === 'success' ? {ok: true, values: [[200]]}
        : {ok: false, code: outcome === 'busy' ? 'SQL_BUSY' : 'SQL_INVALID'});
});
