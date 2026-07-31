import {describe, expect, test} from 'bun:test';
import {nluiBlockSchema} from './schemas.ts';

const chart = {
    id: 'chart-1',
    type: 'chart',
    variant: 'line',
    categoryKey: 'label',
    valueKey: 'value',
    data: [{label: '2025-01', value: 1}]
};

const confirmation = {
    id: 'confirmation-1',
    type: 'confirmation',
    actionId: 'action-1',
    confirmLabel: 'Confirm',
    details: [{label: 'Expires', value: '2026-01-01T12:00:00.000Z'}]
};

describe('NLUI block formatting contracts', () =>
{
    test('only accepts the date formatter implemented for chart categories', () =>
    {
        expect(nluiBlockSchema.safeParse({...chart, categoryFormat: 'date'}).success).toBeTrue();
        expect(nluiBlockSchema.safeParse({...chart, categoryFormat: 'currency'}).success).toBeFalse();
    });

    test('only accepts formats that can render string confirmation details', () =>
    {
        expect(nluiBlockSchema.safeParse({
            ...confirmation,
            details: [{...confirmation.details[0], format: 'date'}]
        }).success).toBeTrue();
        expect(nluiBlockSchema.safeParse({
            ...confirmation,
            details: [{...confirmation.details[0], format: 'status'}]
        }).success).toBeTrue();
        expect(nluiBlockSchema.safeParse({
            ...confirmation,
            details: [{...confirmation.details[0], format: 'currency'}]
        }).success).toBeFalse();
        expect(nluiBlockSchema.safeParse({
            ...confirmation,
            details: [{...confirmation.details[0], format: 'number'}]
        }).success).toBeFalse();
    });
});
