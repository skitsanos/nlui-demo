import {strict as assert} from 'node:assert';
import {JSDOM} from 'jsdom';
import katex from 'katex';

// Isolate DOM globals/prototype regression probes from all other Bun tests.
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {url: 'https://fixture.invalid'});
for (const name of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'HTMLTemplateElement', 'DOMParser', 'Document',
    'DocumentFragment', 'MutationObserver', 'navigator', 'getComputedStyle'])
{
    Object.defineProperty(globalThis, name, {configurable: true, value: name === 'window' ? dom.window
        : (dom.window as unknown as Record<string, unknown>)[name]});
}
const {createRoot} = await import('react-dom/client');
const {flushSync} = await import('react-dom');
const {AssistantMarkdown} = await import('../../src/client/components/AssistantMarkdown.tsx');
const {default: XMarkdown} = await import('@ant-design/x-markdown');
const {default: Latex} = await import('@ant-design/x-markdown/plugins/Latex');
const {default: Parser} = await import('@ant-design/x-markdown/es/XMarkdown/core/Parser');
const root = createRoot(document.getElementById('root')!);
const render = async (node: React.ReactNode) =>
{
    flushSync(() => root.render(node));
    for (let attempt = 0; attempt < 20; attempt++) await new Promise((resolve) => setTimeout(resolve, 1));
    return document.getElementById('root')!;
};
try
{
    assert.equal(katex.version, '0.18.2');
    const inherited = Object.create({trust: true});
    inherited.throwOnError = false;
    inherited.output = 'html';
    const guarded = katex.renderToString(String.raw`\href{javascript:alert(1)}{unsafe}`, inherited);
    assert.doesNotMatch(guarded, /href=|javascript:/);
    const parser = new Parser({escapeRawHtml: true, markedConfig: {extensions: Latex({katexOptions: {trust: false, throwOnError: false}})}});
    const output = parser.parse('Inline $x^2$ and **bold**.\n\n$$\n\\frac{1}{2}\n$$');
    assert.match(output, /inline-katex/);
    assert.match(output, /katex-base/);
    assert.match(output, /<strong>bold<\/strong>/);
    assert.match(output, /mfrac/);
    const markdown = await render(<AssistantMarkdown content={'**A clear answer**\n\n- First\n- Second\n\n[unsafe](javascript:alert(1))\n\n![external](https://fixture.invalid/canary.png)\n\n<img src=x onerror=alert(1)><script>alert(1)</script>'}/>);
    assert.match(markdown.textContent!, /A clear answer/);
    assert.equal(markdown.querySelectorAll('strong').length, 1);
    assert.equal(markdown.querySelectorAll('li').length, 2);
    assert.equal(markdown.querySelectorAll('a,img,script,iframe,svg,[onerror],[onload]').length, 0);
    assert.match(markdown.textContent!, /Image: external/);
    const math = await render(<XMarkdown content={'Inline $x^2$ and tagged $x\\tag{1}$\n\n$$\n\\frac{1}{2}\n$$'}
        config={{extensions: Latex({katexOptions: {trust: false, throwOnError: false}})}} escapeRawHtml/>);
    assert.ok(math.querySelector('.katex-base'));
    assert.ok(math.querySelector('.mfrac'));
    assert.ok(math.querySelector('.katex-tag'));
    assert.equal(math.querySelectorAll('script,[onerror],[onload]').length, 0);
    console.log('MARKDOWN_PROBE_OK patched KaTeX, upstream LaTeX adapter, formatting and sanitized production component');
}
finally
{
    flushSync(() => root.unmount());
    dom.window.close();
}
