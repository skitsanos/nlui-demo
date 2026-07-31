import {describe, expect, test} from 'bun:test';
import type {NluiBlock, TableBlock} from '../nlui/types.ts';
import {
    modelToolOutput,
    resolveStructuredResponse,
    responseTextConfigFor,
    StructuredResponseError
} from './structuredResponse.ts';

const table = (): TableBlock => ({
    id: 'latest-customers',
    type: 'table',
    title: 'Last 5 customers',
    columns: [
        {key: 'number', label: 'Customer number'},
        {key: 'name', label: 'Name'}
    ],
    rows: [
        {number: 'CUS-0160', name: 'Mila Ivanov'},
        {number: 'CUS-0161', name: 'Alex Kowalski'}
    ],
    rowKey: 'number'
});

const encoded = (value: unknown): string => JSON.stringify(value);

describe('structured assistant response', () =>
{
    test('requires a prose message when no trusted blocks exist', () =>
    {
        const resolved = resolveStructuredResponse(encoded({
            presentation: 'message',
            answer: 'There are **200** customers in the synthetic dataset.',
            caption: null,
            block_ids: []
        }), []);

        expect(resolved.text).toContain('200');
        expect(resolved.blocks).toEqual([]);
        expect(responseTextConfigFor([])).toMatchObject({
            format: {
                type: 'json_schema',
                schema: {properties: {presentation: {type: 'string', enum: ['message']}}}
            }
        });
    });

    test('renders table data once through a trusted block-only response', () =>
    {
        const block = table();
        const resolved = resolveStructuredResponse(encoded({
            presentation: 'blocks',
            answer: null,
            caption: null,
            block_ids: [block.id]
        }), [block]);

        expect(resolved.text).toBe('');
        expect(resolved.blocks).toEqual([block]);
        expect(JSON.stringify(resolved.envelope)).not.toContain('CUS-0160');
        expect(JSON.stringify(resolved.blocks)).toContain('CUS-0160');
        expect(responseTextConfigFor([block])).toMatchObject({
            format: {schema: {properties: {caption: {type: 'null'}}}}
        });
        expect(() => resolveStructuredResponse(encoded({
            presentation: 'blocks',
            answer: null,
            caption: 'Here are the rows again.',
            block_ids: [block.id]
        }), [block])).toThrow(StructuredResponseError);
    });

    test('preserves selected block order and a concise caption', () =>
    {
        const first = table();
        const second: NluiBlock = {
            id: 'headline',
            type: 'stats',
            items: [{label: 'Customers', value: 200}]
        };
        const resolved = resolveStructuredResponse(encoded({
            presentation: 'blocks',
            answer: null,
            caption: 'The latest customer records are shown below.',
            block_ids: [second.id, first.id]
        }), [first, second]);

        expect(resolved.text).toBe('The latest customer records are shown below.');
        expect(resolved.blocks.map(({id}) => id)).toEqual(['headline', 'latest-customers']);
    });

    test('rejects unknown, duplicate, and omitted interactive block references atomically', () =>
    {
        const block = table();
        const form: NluiBlock = {
            id: 'return-form',
            type: 'form',
            interactionId: 'return-interaction',
            submitLabel: 'Continue',
            fields: [{name: 'order', label: 'Order', input: 'text'}]
        };
        const response = (blockIds: string[]) => encoded({
            presentation: 'blocks',
            answer: null,
            caption: null,
            block_ids: blockIds
        });

        expect(() => resolveStructuredResponse(response([block.id, 'invented']), [block]))
            .toThrow(StructuredResponseError);
        expect(() => resolveStructuredResponse(response([block.id, block.id]), [block]))
            .toThrow(StructuredResponseError);
        expect(() => resolveStructuredResponse(response([block.id]), [block, form]))
            .toThrow(StructuredResponseError);
    });

    test('shares only safe block references with the model', () =>
    {
        const output = JSON.parse(modelToolOutput({returnedRowCount: 2}, [table()])) as {
            result: unknown;
            ui: {available_blocks: unknown[]};
        };

        expect(output.result).toEqual({returnedRowCount: 2});
        expect(output.ui.available_blocks).toEqual([{
            id: 'latest-customers',
            type: 'table',
            title: 'Last 5 customers',
            required: false
        }]);
        expect(JSON.stringify(output)).not.toContain('Mila Ivanov');
    });
});
