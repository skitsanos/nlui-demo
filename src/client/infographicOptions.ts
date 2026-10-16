import type {InfographicOptions} from '@antv/infographic';
import {type InfographicBlock, infographicBlockSchema } from '../nlui/infographic/schema.ts';
import {formatTemporalValue} from './dateFormat.ts';

export const INFOGRAPHIC_TEMPLATES = {
    comparison: 'compare-binary-horizontal-underline-text-vs',
    timeline: 'sequence-timeline-simple',
    process: 'sequence-steps-simple'
} as const;
const currency = new Intl.NumberFormat('en-GB', {style: 'currency', currency: 'EUR', minimumFractionDigits: 2});
export const infographicValue = (item: InfographicBlock['items'][number]): string => item.value !== undefined
    ? currency.format(item.value) : item.at ? formatTemporalValue(item.at)!.text : item.detail;

// Project only known plain fields. Never spread a wire object into SDK configuration.
export const infographicOptions = (raw: InfographicBlock): Partial<InfographicOptions> =>
{
    const block = infographicBlockSchema.parse(raw);
    const items = block.view === 'comparison'
        ? block.items.map((item) => ({label: item.label, children: [{label: `${item.label} · ${infographicValue(item)}`, desc: item.detail}]}))
        : block.items.map((item, index) => ({label: block.view === 'process' ? `${index + 1}. ${item.label}` : item.label,
            desc: block.view === 'timeline' ? infographicValue(item) : item.detail}));
    const processHeight = Math.max(...block.items.map(({detail}) => Math.ceil(detail.length / 26) * 20 + 80));
    return {
        template: INFOGRAPHIC_TEMPLATES[block.view], editable: false, plugins: [], interactions: [],
        padding: 24, data: {items},
        design: {...block.view === 'comparison' && {structure: {type: 'compare-binary-horizontal', dividerType: 'none', groupGap: 18}},
            items: [block.view === 'process' ? {type: 'simple', width: 280, height: processHeight, showIcon: false}
                : {type: 'underline-text', width: block.view === 'timeline' ? 330 : 240}]},
        themeConfig: {colorPrimary: '#5b5bd6', colorBg: '#ffffff', palette: ['#5b5bd6', '#147d92', '#4a638c', '#6f56a6'],
            base: {text: {'font-family': 'Arial', fill: '#25283f'}}}
    };
};

// SDK templates have repeated internal IDs. Scope both IDs and fragment references per mounted figure.
export const qualifyInfographicSvg = (svg: SVGSVGElement, prefix: string): void =>
{
    // The SDK finishes geometry in a MutationObserver, outside React and its own error event.
    // A nonzero provisional viewBox alone does not prove the hidden figure actually finished.
    if (svg.style.visibility === 'hidden') throw new Error('Visual layout did not finish');
    if (svg.querySelector('script, image, a, iframe, style')) throw new Error('Unsupported SVG content');
    // AntV renders plain labels as foreignObject > span using innerText/textContent.
    // Permit only that exact inert shape, not arbitrary embedded HTML.
    for (const node of svg.querySelectorAll('foreignObject'))
    {
        if (node.children.length !== 1 || node.firstElementChild?.localName !== 'span' || node.firstElementChild.childElementCount !== 0)
            throw new Error('Unsupported embedded text');
        const span = node.firstElementChild as HTMLElement;
        if (span.clientHeight > 0 && span.scrollHeight > span.clientHeight + 2) throw new Error('Clipped visual text');
    }
    const elements = [svg, ...svg.querySelectorAll<SVGElement>('*')];
    for (const element of elements) for (const attribute of element.attributes)
    {
        if (/^on/i.test(attribute.name) || /(?:href)$/i.test(attribute.name) && !attribute.value.startsWith('#')
            || /url\(\s*['"]?(?!#)/i.test(attribute.value)) throw new Error('Unsupported SVG resource');
    }
    const ids = new Map(elements.filter((element) => element.id).map((element, index) => [element.id, `${prefix}-${index}`]));
    for (const element of elements)
    {
        for (const attribute of [...element.attributes])
        {
            let value = attribute.value;
            if (attribute.name === 'id') value = ids.get(value)!;
            else for (const [id, scoped] of ids)
            {
                value = value.replaceAll(`url(#${id})`, `url(#${scoped})`);
                if (value === `#${id}`) value = `#${scoped}`;
            }
            element.setAttribute(attribute.name, value);
        }
    }
};
