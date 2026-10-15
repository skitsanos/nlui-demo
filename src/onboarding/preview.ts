import {createHash} from 'node:crypto';
import {z} from 'zod';
import {CUSTOMER_REGIONS} from '../data/semantic/catalog.ts';

const rowSchema = z.object({month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), region: z.enum(CUSTOMER_REGIONS),
    revenue_eur: z.number().finite().min(0).max(1e12), order_count: z.number().int().min(0).max(1e9)}).strict();
export type PreviewRow = z.infer<typeof rowSchema>;
export interface DatasetPreview {id: string; template: 'monthly-region-v1'; rowCount: number; rows: PreviewRow[];
    fingerprint: string; status: 'quarantined'; executable: false; warnings: string[]}

export const parseCsv = (text: string): string[][] =>
{
    const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false; let endedQuote = false;
    const pushCell = () => {row.push(cell); cell = ''; endedQuote = false; if (row.length > 4) throw new Error('Expected exactly four template columns.');};
    const pushRow = () => {pushCell(); if (row.some(Boolean)) rows.push(row); row = []; if (rows.length > 1001) throw new Error('Preview is limited to 1000 rows.');};
    for (let index = 0; index < text.length; index++)
    {
        const char = text[index]!;
        if (quoted)
        {
            if (char === '"') {if (text[index + 1] === '"') {cell += '"'; index++;} else {quoted = false; endedQuote = true;}}
            else cell += char;
        }
        else if (char === '"' && !cell && !endedQuote) quoted = true;
        else if (char === ',') pushCell();
        else if (char === '\n' || char === '\r') {if (char === '\r' && text[index + 1] === '\n') index++; pushRow();}
        else if (endedQuote) throw new Error('Unexpected characters after a quoted CSV cell.');
        else cell += char;
        if (cell.length > 200) throw new Error('Preview cells are limited to 200 characters.');
    }
    if (quoted) throw new Error('CSV has an unfinished quoted cell.');
    if (cell || row.length || endedQuote) pushRow();
    return rows;
};

export const inspectDatasetUpload = (text: string): DatasetPreview =>
{
    if (new TextEncoder().encode(text).byteLength > 256 * 1024 || text.includes('\0')) throw new Error('Expected a UTF-8 CSV under 256 KiB.');
    const [header, ...records] = parseCsv(text.replace(/^\uFEFF/, ''));
    const expected = ['month', 'region', 'revenue_eur', 'order_count'];
    if (!header || JSON.stringify(header) !== JSON.stringify(expected)) throw new Error('Use the monthly-region-v1 template: month,region,revenue_eur,order_count.');
    if (!records.length) throw new Error('The CSV has no data rows.');
    const seen = new Set<string>();
    const rows = records.map((record) =>
    {
        if (record.length !== 4 || !/^\d+(?:\.\d{1,2})?$/.test(record[2]!) || !/^\d+$/.test(record[3]!)) throw new Error('Revenue and order counts must be plain non-negative numbers.');
        const row = rowSchema.parse({month: record[0], region: record[1], revenue_eur: Number(record[2]), order_count: Number(record[3])});
        const key = `${row.month}:${row.region}`;
        if (seen.has(key)) throw new Error('Each month/region key must be unique.');
        seen.add(key); return row;
    });
    return {id: crypto.randomUUID(), template: 'monthly-region-v1', rowCount: rows.length, rows: rows.slice(0, 10),
        fingerprint: createHash('sha256').update(JSON.stringify(rows)).digest('hex'), status: 'quarantined', executable: false,
        warnings: ['Preview only. This upload is not added to the chat dataset or query schema.', 'Source authority, units and business definitions need separate review before activation.']};
};
