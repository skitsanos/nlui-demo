import {describe, expect, test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import type {ChatActivity} from '../../nlui/types.ts';
import {activityStatusLabel, activityToThoughtChainItem} from './activityReceipt.tsx';

const statuses = [
    ['loading', 'In progress'],
    ['success', 'Completed'],
    ['error', 'Failed'],
    ['abort', 'Cancelled']
] as const satisfies Array<[ChatActivity['status'], string]>;

describe('activity receipt accessibility', () =>
{
    test.each(statuses)('announces %s as %s without exposing an icon name', (status, expectedLabel) =>
    {
        const item = activityToThoughtChainItem({
            id: `activity-${status}`,
            kind: 'data',
            title: 'Checking the demo dataset',
            status,
            receipt: true
        });
        const title = renderToStaticMarkup(item.title);
        const icon = renderToStaticMarkup(item.icon);

        expect(activityStatusLabel(status)).toBe(expectedLabel);
        expect(title).toContain(`Status: ${expectedLabel}`);
        expect(title).toContain('activity-visually-hidden');
        expect(icon).toContain('aria-hidden="true"');
        expect(item.status).toBeUndefined();
        expect(item.collapsible).toBeFalse();
    });
});
