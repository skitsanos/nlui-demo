import {describe, expect, test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {renderToStaticMarkup} from 'react-dom/server';
import {ownedSurfaceCommands} from '../nlui/a2ui/adapter.ts';
import type {InfographicBlock} from '../nlui/infographic/schema.ts';
import {InfographicCard} from './components/InfographicCard.tsx';
import fontCss from './infographicFontCss.ts';
import {configureLocalInfographicFonts} from './infographicFonts.ts';
import {INFOGRAPHIC_TEMPLATES, infographicOptions, infographicValue, qualifyInfographicSvg} from './infographicOptions.ts';

const block: InfographicBlock = {id: 'owned-comparison', type: 'infographic', view: 'comparison', title: 'West and East revenue',
    description: 'Exact comparison, not causation.', snapshot: '2026-06-30T12:00:00.000Z',
    items: [{label: 'West', detail: 'Eligible order revenue · EUR', value: 10.25}, {label: 'East', detail: 'Eligible order revenue · EUR', value: 0}],
    provenance: {source: 'dataset:regional-revenue', fingerprint: 'a'.repeat(64), scope: 'Two regions; EUR; exact comparison.'}};

describe('controlled infographic projection and alternatives', () =>
{
    test('the pinned SDK exposes no remaining remote font URL after local-font qualification', async () =>
    {
        const sdk = await import('@antv/infographic');
        expect(sdk.getFonts().length).toBeGreaterThan(0);
        configureLocalInfographicFonts(sdk.getFonts(), sdk.setDefaultFont);
        expect(sdk.getFonts().every((font) => font.baseUrl === '' && Object.keys(font.fontWeight).length === 0)).toBeTrue();
    });
    test('clears the live font registrations, including encoded names, rather than adding ineffective aliases', () =>
    {
        const font = {fontFamily: 'Alibaba_PuHuiTi', name: 'Example', baseUrl: 'https://example.invalid', fontWeight: {regular: 'remote.css'}};
        let selected = '';
        configureLocalInfographicFonts([font], (name) => {selected = name;});
        expect(font.baseUrl).toBe(''); expect(Object.keys(font.fontWeight)).toEqual([]); expect(selected).toBe('Arial');
    });
    test('the excluded remote-font CSS/export path fails closed, rather than exposing Node builtins to the browser', () =>
    {
        expect(() => fontCss.parse('@font-face {src:url(https://example.invalid/font.woff2)}')).toThrow('disabled');
    });
    test('projects exactly one of three owned templates with exact values, no editing, resources or callbacks', () =>
    {
        const options = infographicOptions(block);
        expect(Object.keys(INFOGRAPHIC_TEMPLATES)).toEqual(['comparison', 'timeline', 'process']);
        expect(options).toMatchObject({template: INFOGRAPHIC_TEMPLATES.comparison, editable: false, plugins: [], interactions: [],
            data: {items: [{label: 'West', children: [{label: 'West · €10.25'}]}, {label: 'East', children: [{label: 'East · €0.00'}]}]}});
        expect(JSON.stringify(options)).not.toMatch(/https?:|data:|ref:|"icon"|"illus"|"action"|onclick/i);
        expect(() => infographicOptions({...block, template: 'evil'} as InfographicBlock)).toThrow();
        expect(() => ownedSurfaceCommands([block])).toThrow('controlled renderer');
    });
    test('readable fallback is default and preserves exact zero, currency, scope, source and fingerprint', () =>
    {
        const html = renderToStaticMarkup(<InfographicCard block={block}/>);
        expect(html).toContain('€10.25'); expect(html).toContain('€0.00'); expect(html).toContain('Revenue (EUR)');
        expect(html).toContain(block.provenance.scope); expect(html).toContain(block.provenance.fingerprint);
        expect(html).not.toContain('infographic-canvas'); expect(html).not.toContain('Loading visual');
    });
    test('invalid descriptors fail closed without reaching the SDK or echoing injected markup', () =>
    {
        const html = renderToStaticMarkup(<InfographicCard block={{...block, title: '<script>bad</script>'}} enabled/>);
        expect(html).toContain('Visual explanation unavailable'); expect(html).not.toContain('<script>'); expect(html).not.toContain('Loading visual');
    });
    test('timestamp display is UTC and ordered alternatives retain machine-readable dates', () =>
    {
        const value: InfographicBlock = {...block, view: 'timeline', items: [{label: 'Created', detail: 'Recorded', at: '2026-06-01T12:00:00.000Z'}],
            provenance: {...block.provenance, source: 'dataset:order-events'}};
        expect(infographicValue(value.items[0]!)).toBe('1 Jun 2026, 12:00 UTC');
        expect(renderToStaticMarkup(<InfographicCard block={value}/>)).toContain('dateTime="2026-06-01T12:00:00.000Z"');
    });
    test('SVG qualification scopes library-internal IDs and references, and rejects unsafe content/resources', () =>
    {
        const dom = new JSDOM('<!doctype html><body></body>');
        try
        {
            const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.innerHTML = '<defs><linearGradient id="gradient"/></defs><path id="line" stroke="url(#gradient)"/>';
            qualifyInfographicSvg(svg, 'unique');
            expect(svg.innerHTML).toContain('id="unique-0"'); expect(svg.innerHTML).toContain('url(#unique-0)');
            svg.innerHTML = '<foreignObject><span xmlns="http://www.w3.org/1999/xhtml">Plain owned text</span></foreignObject>';
            expect(() => qualifyInfographicSvg(svg, 'inert')).not.toThrow();
            svg.style.visibility = 'hidden';
            expect(() => qualifyInfographicSvg(svg, 'unfinished')).toThrow('did not finish');
            svg.style.removeProperty('visibility');
            for (const unsafe of ['<script/>', '<foreignObject/>', '<image href="https://example.invalid"/>', '<path onclick="bad()"/>', '<path fill="url(https://example.invalid)"/>'])
            {
                svg.innerHTML = unsafe; expect(() => qualifyInfographicSvg(svg, 'safe')).toThrow();
            }
        }
        finally {dom.window.close();}
    });
});
