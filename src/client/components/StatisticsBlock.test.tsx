import {describe, expect, test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import type {StatsBlock} from '../../nlui/types.ts';
import {NluiRenderer} from './NluiRenderer.tsx';
import {StatisticsBlock} from './StatisticsBlock.tsx';

const block: StatsBlock = {id: 'product-summary', type: 'stats', title: 'Northstar Pro 7',
    description: 'A workstation for design and development.', items: [
        {label: 'Price', value: 1499.95, format: 'currency'}, {label: 'Rating', value: '4.8 / 5'},
        {label: 'In stock', value: 42, trend: 'up'}, {label: 'Category', value: 'Laptops'},
        {label: 'Registered at', value: '2025-12-14T12:00:00.000Z', format: 'date'}
    ]};

describe('statistic context and accessible grouping', () =>
{
    test('renders product title and description with explicit region associations', () =>
    {
        const html = renderToStaticMarkup(<StatisticsBlock block={block}/>);
        expect(html).toMatch(/<h3[^>]*>Northstar Pro 7<\/h3>/);
        expect(html).toContain(block.description!);
        const titleId = html.match(/aria-labelledby="([^"]+)"/)?.[1];
        const descriptionId = html.match(/aria-describedby="([^"]+)"/)?.[1];
        expect(titleId).toBeDefined();
        expect(descriptionId).toBeDefined();
        expect(html).toContain(`id="${titleId}"`);
        expect(html).toContain(`id="${descriptionId}"`);
    });

    test('retains the same metric labels, values, formatting and card layout', () =>
    {
        const html = renderToStaticMarkup(<StatisticsBlock block={block}/>);
        for (const item of block.items) expect(html).toContain(item.label);
        expect(html).toContain('€1,499.95');
        expect(html).toContain('4.8 / 5');
        expect(html).toContain('>42<');
        expect(html).toContain('Laptops');
        expect(html).toContain('14 Dec 2025, 12:00 UTC');
        expect(html).toContain('stat-grid');
        expect(html).toContain('stat-card stat-card-temporal');
        expect(html).toContain('trend-up');
        expect(html.match(/class="ant-card /g)).toHaveLength(block.items.length);
    });

    test('order titles appear through the actual NLUI renderer rather than only the isolated component', () =>
    {
        const html = renderToStaticMarkup(<NluiRenderer conversationId="stats-render-test" onInteraction={async () => true}
            blocks={[{...block, id: 'order-summary', title: 'ORD-1176', description: 'Order summary for review.'}]}/>);
        expect(html).toMatch(/<h3[^>]*>ORD-1176<\/h3>/);
        expect(html).toContain('Order summary for review.');
    });

    test('repeated titles and even repeated source IDs get unique accessible references', () =>
    {
        const html = renderToStaticMarkup(<><StatisticsBlock block={block}/><StatisticsBlock block={block}/></>);
        const titles = [...html.matchAll(/aria-labelledby="([^"]+)"/g)].map((match) => match[1]);
        const descriptions = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map((match) => match[1]);
        expect(new Set(titles).size).toBe(2);
        expect(new Set(descriptions).size).toBe(2);
    });

    test.each([{}, {description: 'Description only'}])('untitled blocks remain named without an empty heading', (metadata) =>
    {
        const html = renderToStaticMarkup(<StatisticsBlock block={{id: 'untitled', type: 'stats', items: block.items, ...metadata}}/>);
        expect(html).toContain('aria-label="Summary statistics"');
        expect(html).not.toContain('<h3');
        expect(html).not.toContain('aria-labelledby');
    });

    test('model-supplied metadata remains plain escaped text', () =>
    {
        const html = renderToStaticMarkup(<StatisticsBlock block={{...block, title: '<img src=x onerror=alert(1)>',
            description: '<script>alert(1)</script>'}}/>);
        expect(html).toContain('&lt;img');
        expect(html).toContain('&lt;script&gt;');
        expect(html).not.toContain('<img');
        expect(html).not.toContain('<script>');
    });
});
