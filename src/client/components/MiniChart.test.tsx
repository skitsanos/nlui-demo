import {describe, expect, test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import type {ChartBlock} from '../../nlui/types.ts';
import {MiniChart} from './MiniChart.tsx';

const temporalChart = (variant: ChartBlock['variant']): ChartBlock => ({
    id: `temporal-${variant}`,
    type: 'chart',
    title: 'Registrations',
    variant,
    categoryKey: 'label',
    valueKey: 'value',
    categoryFormat: 'date',
    data: [{label: '2025-12-14T12:00:00.000Z', value: 4}]
});

describe('temporal chart labels', () =>
{
    test.each(['bar', 'line'] as const)('keeps full %s labels in the description and compact labels on the axis', (variant) =>
    {
        const html = renderToStaticMarkup(<MiniChart block={temporalChart(variant)}/>);

        expect(html).toContain('<desc>14 Dec 2025, 12:00 UTC: 4</desc>');
        expect(html).toContain('>14 Dec 25</text>');
        expect(html).not.toContain('14 Dec 20…');
    });

    test('does not invent a compact label for an invalid date', () =>
    {
        const block = temporalChart('line');
        block.data = [{label: '2025-02-29', value: 2}];

        const html = renderToStaticMarkup(<MiniChart block={block}/>);
        expect(html).toContain('<desc>2025-02-29: 2</desc>');
        expect(html).toContain('>2025-02-29</text>');
    });
});
