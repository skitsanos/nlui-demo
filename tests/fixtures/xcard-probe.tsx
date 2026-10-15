import {strict as assert} from 'node:assert';
import {JSDOM} from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {url: 'https://fixture.invalid'});
for (const name of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'HTMLTemplateElement', 'DOMParser', 'Document',
    'DocumentFragment', 'MutationObserver', 'navigator', 'getComputedStyle', 'ShadowRoot', 'SVGElement'])
    Object.defineProperty(globalThis, name, {configurable: true, value: name === 'window' ? dom.window
        : (dom.window as unknown as Record<string, unknown>)[name]});
dom.window.matchMedia = (() => ({matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}})) as unknown as typeof matchMedia;
const {createRoot} = await import('react-dom/client');
const {flushSync} = await import('react-dom');
const {ExperimentalSurface} = await import('../../src/client/components/ExperimentalSurface.tsx');
const root = createRoot(document.getElementById('root')!);
try
{
    flushSync(() => root.render(<ExperimentalSurface conversationId="owned" onInteraction={async () => true} blocks={[
        {id: 'owned-notice', type: 'result', title: 'Verified result', status: 'success', message: 'Owned data reached the actual X Card renderer.'}
    ]}/>));
    for (let attempt = 0; attempt < 50 && !document.body.textContent?.includes('Owned data reached'); attempt++)
        await new Promise((resolve) => setTimeout(resolve, 2));
    assert.match(document.body.textContent!, /Owned data reached the actual X Card renderer/);
    assert.doesNotMatch(document.body.textContent!, /Waiting for validated data/);
    assert.ok(document.querySelector('[data-renderer="x-card-2.9.0"]'));
    console.log('XCARD_PROBE_OK actual X Card root-model binding and owned renderer');
}
finally {flushSync(() => root.unmount()); dom.window.close();}
