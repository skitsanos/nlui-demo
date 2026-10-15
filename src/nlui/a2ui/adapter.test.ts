import {describe, expect, test} from 'bun:test';
import type {NluiBlock} from '../types.ts';
import {A2UI_CATALOG_ID, OwnedSurfaceAdapter, ownedSurfaceCommands, qualifySurface} from './adapter.ts';

const blocks: NluiBlock[] = [{id: 'issued-table', type: 'table', title: 'Orders', rowKey: 'id', columns: [{key: 'id', label: 'Order'}], rows: [{id: 'ORD-1'}]}];
describe('negotiated A2UI v0.9 ownership adapter', () =>
{
    test('supports progressive surface/structure/data, exact issued bindings and explicit completion', () =>
    {
        const adapter = new OwnedSurfaceAdapter(blocks); const commands = ownedSurfaceCommands(blocks, 'Review these orders.');
        for (const command of commands) adapter.apply(command);
        expect(() => adapter.complete('surface-issued-table')).not.toThrow();
        expect(qualifySurface(commands, blocks)).toHaveLength(3);
        expect(() => adapter.apply(commands[0])).toThrow('already exists');
        adapter.apply({version: 'v0.9', deleteSurface: {surfaceId: 'surface-issued-table'}});
        expect(adapter.surfaces.size).toBe(0);
    });

    test.each([
        {version: 'v0.8', createSurface: {surfaceId: 's', catalogId: A2UI_CATALOG_ID}},
        {version: 'v0.9', createSurface: {surfaceId: 's', catalogId: 'https://evil.test/catalog'}},
        {version: 'v0.9', updateComponents: {surfaceId: 's', components: [{id: 'root', component: 'Script', src: 'javascript:alert(1)'}]}},
        {version: 'v0.9', updateComponents: {surfaceId: 's', components: [{id: 'root', component: 'Text', text: 'Hello', onClick: 'fetch(secret)'}]}},
        {version: 'v0.9', updateComponents: {surfaceId: 's', components: [{id: 'root', component: 'Table', blockRef: 'unissued'}]}},
        {version: 'v0.9', updateComponents: {surfaceId: 's', components: [{id: 'root', component: 'Button', label: 'Cancel order', actionRef: 'cancel_order'}]}},
        {version: 'v0.9', updateDataModel: {surfaceId: 's', path: '/__proto__', value: {polluted: true}}},
        {version: 'v0.9', updateComponents: {surfaceId: 's', components: [{id: 'root', component: 'Text', text: {path: '/constructor/prototype'}}]}},
        {version: 'v0.9', updateComponents: {surfaceId: 's', components: [{id: 'root', component: 'Column', children: ['root']}]}},
        {version: 'v0.9', updateComponents: {surfaceId: 's', components: [{id: 'root', component: 'Text', text: 'One'}, {id: 'root', component: 'Text', text: 'Two'}]}}
    ])('rejects unsafe/unknown command without forwarding behavior', (command) =>
    {
        const adapter = new OwnedSurfaceAdapter(blocks);
        adapter.apply({version: 'v0.9', createSurface: {surfaceId: 's', catalogId: A2UI_CATALOG_ID}});
        expect(() => adapter.apply(command)).toThrow();
        expect(adapter.surfaces.get('s')!.components.size).toBe(0);
    });

    test('does not mark missing children or bindings complete; opaque buttons need a separately issued mapping', () =>
    {
        const adapter = new OwnedSurfaceAdapter(blocks, ['opaque-allowed']);
        adapter.apply({version: 'v0.9', createSurface: {surfaceId: 's', catalogId: A2UI_CATALOG_ID}});
        adapter.apply({version: 'v0.9', updateComponents: {surfaceId: 's', components: [{id: 'root', component: 'Column', children: ['later']}]}});
        expect(() => adapter.complete('s')).toThrow('Missing child');
        adapter.apply({version: 'v0.9', updateComponents: {surfaceId: 's', components: [{id: 'later', component: 'Button', label: 'Continue', actionRef: 'opaque-allowed'}]}});
        expect(() => adapter.complete('s')).not.toThrow();
    });
});
