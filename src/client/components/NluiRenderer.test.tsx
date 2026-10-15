import {describe, expect, test} from 'bun:test';
import {isValidElement, type ReactElement, type ReactNode} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {TableBlock} from '../../nlui/types.ts';
import {DataTable} from './DataTable.tsx';
import {NluiRenderer} from './NluiRenderer.tsx';

const tableBlock: TableBlock = {
    id: 'orders',
    type: 'table',
    title: 'Delayed orders requiring review',
    rowKey: 'order',
    columns: [
        {key: 'order', label: 'Order'},
        {key: 'expectedDeliveryAt', label: 'Expected delivery', format: 'date'}
    ],
    rows: [{order: 'ORD-123456', expectedDeliveryAt: '2026-07-30'}]
};

const asElement = (value: ReactNode): ReactElement<Record<string, unknown>> =>
{
    expect(isValidElement(value)).toBeTrue();
    return value as ReactElement<Record<string, unknown>>;
};

test('choice cards reserve one radio/checkbox column and keep specification content together', async () =>
{
    const css = await Bun.file(new URL('../styles.css', import.meta.url)).text();
    expect(css).toContain('grid-template-columns: 16px minmax(0, 1fr)');
    expect(css).toContain('.choice-card > .ant-checkbox, .choice-card > .ant-radio');
    expect(css).toContain('grid-row: 1 / span 4; align-self: start');
    expect(css).toContain('.choice-card > span:last-child > * { grid-column: 2; min-width: 0; }');
});

describe('NLUI tables', () =>
{
    test('use an app-owned full-width card and an intrinsic horizontal scroll width', () =>
    {
        const stack = NluiRenderer({
            blocks: [tableBlock],
            conversationId: 'conversation-test',
            onInteraction: async () => true
        });
        const wrapper = asElement((stack.props.children as ReactNode[])[0]);
        const card = asElement((wrapper.props.children as ReactNode[])[1]);
        const dataTable = DataTable({block: tableBlock});
        const region = asElement((dataTable.props.children as ReactNode[])[2]);
        const table = asElement(region.props.children as ReactNode);

        expect(card.props.className).toBe('nlui-card nlui-table-card');
        expect(region.type).toBe('section');
        expect(region.props['aria-label']).toBe('Delayed orders requiring review');
        expect(table.props.className).toBe('nlui-table');
        expect(table.props.scroll).toEqual({x: 'max-content'});
    });

    test('keeps long headers and exact values available to the table', () =>
    {
        const html = renderToStaticMarkup(<NluiRenderer
            blocks={[tableBlock]}
            conversationId="conversation-test"
            onInteraction={async () => true}
        />);

        expect(html).toContain('Expected delivery');
        expect(html).toContain('ORD-123456');
        expect(html).toContain('30 Jul 2026');
    });
});
