import {Database} from 'bun:sqlite';
import {createHash} from 'node:crypto';

const tables = ['customers', 'products', 'orders', 'order_items', 'payments', 'shipments', 'returns', 'support_cases'];
export const captureFixtureState = (databasePath: string): Record<string, unknown> =>
{
    const database = new Database(databasePath, {readonly: true, strict: true});
    try
    {
        const hashes = Object.fromEntries(tables.map((table) => [table, createHash('sha256')
            .update(JSON.stringify(database.query(`SELECT * FROM ${table} ORDER BY id`).all())).digest('hex')]));
        return {
            tables: hashes,
            businessFingerprint: createHash('sha256').update(JSON.stringify(hashes)).digest('hex'),
            returnsCount: database.query<{n: number}, []>('SELECT COUNT(*) AS n FROM returns').get()!.n,
            requestedReturns: database.query<{n: number}, []>("SELECT COUNT(*) AS n FROM returns WHERE status = 'requested'").get()!.n,
            completedActions: database.query<{n: number}, []>("SELECT COUNT(*) AS n FROM pending_actions WHERE status = 'completed'").get()!.n,
            address1176: database.query(`SELECT shipping_line1, shipping_city, shipping_postal_code, shipping_country
                FROM orders WHERE id = 1176`).get(),
            status1176: database.query<{status: string}, []>('SELECT status FROM orders WHERE id = 1176').get()!.status
        };
    }
    finally {database.close();}
};
