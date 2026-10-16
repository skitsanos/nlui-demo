import {Database} from 'bun:sqlite';
import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDemoRepository} from '../../data/index.ts';
import type {DemoRepository} from '../../data/types.ts';
import {resolveStructuredResponse, responseTextConfigFor} from '../../services/structuredResponse.ts';
import {nluiBlocksSchema} from '../schemas.ts';
import {toolsForQueryArm} from '../toolDefinitions.ts';
import {executeNluiTool} from '../tools.ts';
import type {ToolDataSource} from '../toolTypes.ts';
import {INFOGRAPHIC_PROMPT, INFOGRAPHIC_TOOL} from './catalog.ts';
import {infographicHandler} from './handler.ts';
import {type InfographicBlock, infographicBlockSchema} from './schema.ts';

let directory: string; let data: ToolDataSource; let database: Database;
beforeAll(() =>
{
    directory = mkdtempSync(join(tmpdir(), 'nlui-infographic-'));
    const databasePath = join(directory, 'demo.sqlite');
    data = {databasePath, repository: createDemoRepository({databasePath})};
    database = new Database(databasePath, {readonly: true});
});
afterAll(() => {database?.close(true); data?.repository.close(); if (directory) rmSync(directory, {recursive: true, force: true});});
const comparison = {view: 'comparison', regions: ['West', 'East'], from: '2026-01-01', to: '2026-06-30', order_number: null};
const timeline = {view: 'timeline', regions: [], from: null, to: null, order_number: 'ORD-1042'};
const processArgs = {view: 'process', regions: [], from: null, to: null, order_number: null};
const execute = (args: unknown, enabled = true) => executeNluiTool('get_infographic', JSON.stringify(args), undefined, data, {infographics: enabled});
const blockFor = async (args: unknown): Promise<InfographicBlock> => infographicBlockSchema.parse((await execute(args)).blocks[0]);
const mock = (overrides: Partial<DemoRepository>) => new Proxy(data.repository, {get: (target, key) =>
    key in overrides ? overrides[key as keyof DemoRepository] : typeof Reflect.get(target, key) === 'function'
        ? Reflect.get(target, key).bind(target) : Reflect.get(target, key)});

describe('owned infographic capability', () =>
{
    test('is absent by default, explicitly gated in both query arms and rejected at execution', async () =>
    {
        for (const arm of ['control', 'semantic'] as const)
        {
            expect(toolsForQueryArm(arm).some(({name}) => name === 'get_infographic')).toBeFalse();
            expect(toolsForQueryArm(arm, true).filter(({name}) => name === 'get_infographic')).toEqual([INFOGRAPHIC_TOOL]);
        }
        expect(await execute(comparison, false)).toMatchObject({modelOutput: {ok: false}, blocks: []});
        expect(INFOGRAPHIC_TOOL.parameters).toMatchObject({additionalProperties: false,
            required: ['view', 'regions', 'from', 'to', 'order_number']});
        expect(INFOGRAPHIC_TOOL.parameters?.properties).not.toHaveProperty('items');
        expect(INFOGRAPHIC_PROMPT).toContain('single number, lists of records, monthly trends, causes, funnels');
    });

    test('binds exact independent eligible-order sums, preserves selection order, scope and EUR', async () =>
    {
        const block = await blockFor(comparison);
        const expected = database.query<{region: string; cents: number}, []>(`SELECT region, SUM(total_cents) cents FROM orders
            WHERE created_at >= '2026-01-01' AND created_at < '2026-07-01' AND status NOT IN ('cancelled','returned') GROUP BY region`).all();
        expect(block.items).toEqual(['West', 'East'].map((label) => ({label, detail: 'Eligible order revenue · EUR',
            value: Number((expected.find((row) => row.region === label)!.cents / 100).toFixed(2))})));
        expect(block.provenance.scope).toContain('2026-01-01 to 2026-06-30 inclusive');
        expect(block.provenance.scope).toContain('cancelled and returned orders excluded');
        const reversed = await blockFor({...comparison, regions: ['East', 'West']});
        expect(reversed.items).toEqual([...block.items].reverse());
        expect(reversed.provenance.fingerprint).not.toBe(block.provenance.fingerprint);
        const output = (await execute(comparison)).modelOutput;
        expect(output).not.toHaveProperty('rows'); expect(output).not.toHaveProperty('items');
    });

    test('represents a zero-order period as exact zero, not invented growth or a percentage', async () =>
    {
        const block = await blockFor({...comparison, from: '2020-01-01', to: '2020-01-31'});
        expect(block.items.map(({value}) => value)).toEqual([0, 0]);
        expect(block.description).toContain('not an explanation of why');
    });

    for (const args of [
        {...comparison, regions: ['West', 'West']}, {...comparison, regions: ['West']}, {...comparison, regions: ['Atlantis', 'West']},
        {...comparison, from: null}, {...comparison, from: '2026-07-01'}, {...comparison, to: '2026-07-01'},
        {...comparison, from: '2026-02-30'}, {...comparison, order_number: 'ORD-1042'},
        {...comparison, template: 'arbitrary'}, {...comparison, items: [{value: 999}]}, {...comparison, action: 'cancel_order'},
        {...timeline, regions: ['West']}, {...timeline, order_number: "ORD-1'; DELETE FROM orders"}, {...processArgs, order_number: 'ORD-1042'},
        {...processArgs, view: 'funnel'}
    ]) test(`rejects unsupported scope or model configuration: ${JSON.stringify(args)}`, async () =>
    {
        expect(await execute(args)).toMatchObject({modelOutput: {ok: false}, blocks: []});
    });

    test('shows only actual UTC events in chronological order, never expected delivery or inferred refund completion', async () =>
    {
        const block = await blockFor(timeline); const order = data.repository.getOrder('ORD-1042')!;
        const dates = [order.createdAt, order.payment?.paidAt, order.shipment?.shippedAt, order.shipment?.deliveredAt,
            ...order.returns.map(({requestedAt}) => requestedAt)].filter((at): at is string => !!at)
            .filter((at) => Date.parse(at) <= Date.parse(block.snapshot)).sort((a, b) => Date.parse(a) - Date.parse(b))
            .map((at) => new Date(at).toISOString());
        expect(block.items.map(({at}) => at)).toEqual(dates);
        expect(block.items.every(({label}) => !/expected|refund completed/i.test(label))).toBeTrue();
        expect(block.provenance.scope).toContain('UTC');
        expect(await execute({...timeline, order_number: 'ORD-999999'})).toMatchObject({modelOutput: {ok: false}, blocks: []});
        const encoded = JSON.stringify(block); expect(encoded).not.toContain(order.customerEmail); expect(encoded).not.toContain('shippingAddress');
    });

    test('missing milestones stay unknown; future-dated records are not presented as observed', () =>
    {
        const source = data.repository.getOrder('ORD-1042')!;
        const repository = mock({getOrder: () => ({...source, payment: null, shipment: source.shipment
            ? {...source.shipment, shippedAt: null, deliveredAt: '2099-01-01T00:00:00Z'} : null, returns: []})});
        const block = infographicHandler(timeline, {data: {...data, repository}}).blocks[0] as InfographicBlock;
        expect(block.items).toHaveLength(1); expect(block.items[0]?.label).toBe('Order created');
        expect(block.description).toContain('unknown');
    });

    test('policy steps preserve retrieved conditions, are fingerprinted, and never authorize actions', async () =>
    {
        const block = await blockFor(processArgs);
        const excerpts = data.repository.getPolicySections('knowledge/returns-policy.md');
        expect(block.items).toHaveLength(4);
        expect(block.items.every(({detail}) => excerpts.some(({text}) => text === detail))).toBeTrue();
        expect(block.items[0]?.detail).toContain('30 calendar days');
        expect(block.items[1]?.detail).toContain('final sale');
        expect(block.items[3]?.detail).toContain('receives and inspects');
        expect(block.items[3]?.detail).toContain('5 to 7 business days');
        expect(block.items[0]?.detail).toEndWith('return authorization number and instructions.');
        expect(block.items[3]?.detail).toEndWith('unless the item was damaged or incorrect.');
        expect(block.provenance.source).toBe('knowledge/returns-policy.md');
        expect(block.description).toContain('Nothing is submitted'); expect(block).not.toHaveProperty('actionId');
        expect(() => infographicHandler(processArgs, {data: {...data, repository: mock({getPolicySections: () => []})}})).toThrow('unavailable');
    });

    test('only issued, validated blocks can be selected by the existing strict JSON envelope', async () =>
    {
        const block = await blockFor(comparison);
        const encoded = JSON.stringify({presentation: 'blocks', answer: null, caption: 'Here is the requested comparison; it does not establish causation.', block_ids: [block.id]});
        expect(resolveStructuredResponse(encoded, [block]).blocks).toEqual([block]);
        expect(responseTextConfigFor([block]).format?.type).toBe('json_schema');
        expect(() => resolveStructuredResponse(encoded.replace(block.id, 'invented'), [block])).toThrow();
        expect(nluiBlocksSchema.safeParse([block]).success).toBeTrue();
    });

    test('rejects assets, script/markup labels, hidden actions, non-finite values and invalid shapes before the SDK', async () =>
    {
        const block = await blockFor(comparison);
        const invalid = [ {...block, svg: '<svg/>'}, {...block, actionId: 'opaque'}, {...block, items: [...block.items, block.items[0]]},
            {...block, items: block.items.map((item) => ({...item, value: Number.NaN}))},
            ...['<img onerror=x>', 'javascript:alert(1)', 'data:image/svg+xml,abc', 'ref:remote:secret', 'line\nbreak'].map((label) =>
                ({...block, items: [{...block.items[0], label}, block.items[1]]})),
            {...block, items: [{...block.items[0], icon: 'https://example.invalid'}, block.items[1]]} ];
        expect(invalid.every((candidate) => !infographicBlockSchema.safeParse(candidate).success)).toBeTrue();
    });
});
