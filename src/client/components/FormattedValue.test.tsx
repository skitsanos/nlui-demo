import {describe, expect, test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {FormattedValue} from './FormattedValue.tsx';
import {NluiRenderer} from './NluiRenderer.tsx';

describe('formatted NLUI values', () =>
{
    test('renders an accessible human timestamp while retaining the exact instant', () =>
    {
        const html = renderToStaticMarkup(
            <FormattedValue value="2025-12-14T12:00:00.000Z" format="date"/>
        );

        expect(html).toContain('<time dateTime="2025-12-14T12:00:00.000Z"');
        expect(html).toContain('title="Original value: 2025-12-14T12:00:00.000Z"');
        expect(html).toContain('>14 Dec 2025, 12:00 UTC</time>');
    });

    test('leaves an invalid date-like value visible instead of inventing a date', () =>
    {
        expect(renderToStaticMarkup(<FormattedValue value="not-a-date" format="date"/>)).toBe('not-a-date');
    });

    test('marks temporal statistic cards for responsive layout', () =>
    {
        const html = renderToStaticMarkup(<NluiRenderer
            conversationId="conversation-test"
            onInteraction={async () => true}
            blocks={[{
                id: 'registered-at',
                type: 'stats',
                items: [{label: 'Registered at', value: '2025-12-14T12:00:00.000Z', format: 'date'}]
            }]}
        />);

        expect(html).toContain('stat-card stat-card-temporal');
        expect(html).toContain('>14 Dec 2025, 12:00 UTC</time>');
    });
});
