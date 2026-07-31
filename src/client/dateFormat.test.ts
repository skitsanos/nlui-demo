import {describe, expect, test} from 'bun:test';
import {formatTemporalValue} from './dateFormat.ts';

describe('temporal display formatting', () =>
{
    test('formats calendar dates and months without a timezone shift', () =>
    {
        expect(formatTemporalValue('2025-12-14')).toEqual({
            dateTime: '2025-12-14',
            text: '14 Dec 2025'
        });
        expect(formatTemporalValue('2025-12')).toEqual({
            dateTime: '2025-12',
            text: 'Dec 2025'
        });
    });

    test('formats ISO and SQLite timestamps as explicit UTC instants', () =>
    {
        expect(formatTemporalValue('2025-12-14T12:00:00.000Z')).toEqual({
            dateTime: '2025-12-14T12:00:00.000Z',
            text: '14 Dec 2025, 12:00 UTC'
        });
        expect(formatTemporalValue('2025-12-14 12:34:56')).toEqual({
            dateTime: '2025-12-14T12:34:56.000Z',
            text: '14 Dec 2025, 12:34:56 UTC'
        });
        expect(formatTemporalValue('2025-12-14T14:00:00+02:00')).toEqual({
            dateTime: '2025-12-14T12:00:00.000Z',
            text: '14 Dec 2025, 12:00 UTC'
        });
    });

    test('preserves invalid, ambiguous, and non-string values for their caller', () =>
    {
        for (const value of ['2025-02-29', '2025-13', '2025-Q4', 'not-a-date', '', null, 2025])
        {
            expect(formatTemporalValue(value)).toBeUndefined();
        }
    });
});
