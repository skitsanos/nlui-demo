import {describe, expect, test} from 'bun:test';
import type {
    ResponseCreateParamsStreaming,
    ResponseStreamEvent
} from 'openai/resources/responses/responses';
import type {ToolExecution} from '../nlui/tools.ts';
import type {ChatStreamEvent, TableBlock} from '../nlui/types.ts';
import {chatInstructionsFor, promptVersionFor} from './chatPrompt.ts';
import {createOpenAIChatRunner, type OpenAIChatDependencies} from './openaiChatRunner.ts';
import {StructuredResponseError} from './structuredResponse.ts';

const event = (value: unknown): ResponseStreamEvent => value as ResponseStreamEvent;

const responseCreated = (id: string): ResponseStreamEvent => event({
    type: 'response.created',
    response: {id, model: 'test-model'}
});

const responseCompleted = (id: string): ResponseStreamEvent => event({
    type: 'response.completed',
    response: {id, model: 'test-model', usage: null}
});

const table: TableBlock = {
    id: 'latest-customers',
    type: 'table',
    title: 'Last 5 customers',
    columns: [
        {key: 'number', label: 'Customer number'},
        {key: 'name', label: 'Name'}
    ],
    rows: [{number: 'CUS-0160', name: 'Mila Ivanov'}],
    rowKey: 'number'
};

const toolRound = (): ResponseStreamEvent[] => [
    responseCreated('response-tool'),
    event({
        type: 'response.output_text.delta',
        delta: '{"presentation":"message","answer":"CUS-0160 — Mila Ivanov","caption":null,"block_ids":[]}'
    }),
    event({
        type: 'response.output_item.done',
        item: {
            type: 'function_call',
            call_id: 'call-query',
            name: 'query_dataset',
            arguments: '{"sql":"SELECT customer_number FROM customers LIMIT 5"}'
        }
    }),
    responseCompleted('response-tool')
];

const finalRound = (blockIds: string[], caption: string | null = 'I found the latest customer records and kept the details in the table for a quick scan.'): ResponseStreamEvent[] =>
{
    const encoded = JSON.stringify({
        presentation: 'blocks',
        answer: null,
        caption,
        block_ids: blockIds
    });
    return [
        responseCreated('response-final'),
        event({type: 'response.output_text.delta', delta: encoded.slice(0, 25)}),
        event({type: 'response.output_text.delta', delta: encoded.slice(25)}),
        responseCompleted('response-final')
    ];
};

const messageRound = (): ResponseStreamEvent[] => [
    responseCreated('response-message'),
    event({
        type: 'response.output_text.delta',
        delta: JSON.stringify({
            presentation: 'message',
            answer: 'The semantic query arm returned a concise answer.',
            caption: null,
            block_ids: []
        })
    }),
    responseCompleted('response-message')
];

const dependenciesFor = (rounds: ResponseStreamEvent[][]) =>
{
    const requests: ResponseCreateParamsStreaming[] = [];
    const issued: TableBlock[][] = [];
    const execution: ToolExecution = {
        modelOutput: {ok: true, returnedRowCount: 1, renderedAs: 'table', dataLocation: 'trusted_ui_block'},
        traceOutput: {ok: true, rows: [{number: 'CUS-0160', name: 'Mila Ivanov'}]},
        blocks: [table]
    };
    const dependencies: OpenAIChatDependencies = {
        model: 'test-model',
        createResponse: async (params) =>
        {
            requests.push(params);
            const next = rounds.shift();
            if (!next) throw new Error('No fake provider round remains');
            return (async function* ()
            {
                for (const item of next) yield item;
            })();
        },
        executeTool: async () => execution,
        issueCapabilities: (_conversationId, blocks) => issued.push(blocks as TableBlock[])
    };
    return {dependencies, requests, issued};
};

describe('OpenAI chat structured composition', () =>
{
    test('keeps control guidance stable while semantic v2 owns metric scope and presentation', () =>
    {
        const control = chatInstructionsFor('control');
        const semantic = chatInstructionsFor('semantic');

        expect(promptVersionFor('control')).toBe('nlui-controller-v5-annotated');
        expect(promptVersionFor('semantic')).toBe('nlui-controller-v5-annotated-semantic-v2');
        expect(control).toContain('Use query_dataset for customer counts');
        expect(control).not.toContain('customer_registrations');
        expect(semantic).toContain('registered_customer_count only for the current lifetime');
        expect(semantic).toContain('Use customer_registrations');
        expect(semantic).toContain('do not repeat it with a month filter');
        expect(semantic).toContain('already exclude cancelled and returned orders');
        expect(semantic).toContain('server, not you, chooses the renderer');
    });

    test('uses injected tools, instructions, and prompt version for an experiment arm', async () =>
    {
        const {dependencies, requests} = dependenciesFor([messageRound()]);
        const tools: NonNullable<OpenAIChatDependencies['tools']> = [{
            type: 'function',
            name: 'semantic_query',
            description: 'Run one server-owned semantic query.',
            strict: true,
            parameters: {
                type: 'object',
                properties: {},
                required: [],
                additionalProperties: false
            }
        }];
        const instructions = 'Use semantic_query for analytical dataset questions.';
        const promptVersion = 'nlui-controller-semantic-test';
        const runner = createOpenAIChatRunner({...dependencies, tools, instructions, promptVersion});

        const result = await runner({
            conversationId: 'conversation-semantic-arm',
            input: {type: 'user_text', text: 'How many customers are there?'}
        }, () => undefined, new AbortController().signal);

        expect(requests).toHaveLength(1);
        expect(requests[0]?.tools).toEqual(tools);
        expect(requests[0]?.instructions).toBe(instructions);
        expect(result.promptVersion).toBe(promptVersion);
    });

    test('buffers provisional prose and raw JSON until an annotation and one trusted table are selected', async () =>
    {
        const {dependencies, requests, issued} = dependenciesFor([toolRound(), finalRound([table.id])]);
        const events: ChatStreamEvent[] = [];
        const runner = createOpenAIChatRunner(dependencies);
        const result = await runner({
            conversationId: 'conversation-structured-test',
            input: {type: 'user_text', text: 'Show me the last 5 customers'}
        }, (next) => events.push(next), new AbortController().signal);

        expect(events.filter(({type}) => type === 'text.delta')).toEqual([{
            type: 'text.delta',
            delta: 'I found the latest customer records and kept the details in the table for a quick scan.'
        }]);
        expect(events.filter(({type}) => type === 'ui.block')).toEqual([{type: 'ui.block', block: table}]);
        expect(events.filter(({type}) => ['text.delta', 'ui.block', 'message.completed'].includes(type))
            .map(({type}) => type)).toEqual(['text.delta', 'ui.block', 'message.completed']);
        expect(events.filter(({type}) => type === 'text.delta').some((item) => JSON.stringify(item).includes('CUS-0160')))
            .toBeFalse();
        expect(events.at(-1)?.type).toBe('message.completed');
        expect(result.text).toContain('quick scan');
        expect(result.blocks).toEqual([table]);
        expect(issued).toEqual([[table]]);

        expect(requests).toHaveLength(2);
        expect(requests[0]?.text?.format?.type).toBe('json_schema');
        const finalSchema = requests[1]?.text?.format && 'schema' in requests[1].text.format
            ? requests[1].text.format.schema as {properties: {presentation: {enum: string[]}}}
            : undefined;
        expect(finalSchema?.properties.presentation.enum).toEqual(['blocks']);

        const secondInput = requests[1]?.input as Array<{type: string; output: string}>;
        expect(secondInput[0]?.type).toBe('function_call_output');
        expect(secondInput[0]?.output).toContain('latest-customers');
        expect(secondInput[0]?.output).not.toContain('Mila Ivanov');
    });

    test('rejects an invented block reference before emitting content or issuing capabilities', async () =>
    {
        const {dependencies, issued} = dependenciesFor([toolRound(), finalRound([table.id, 'invented'])]);
        const events: ChatStreamEvent[] = [];
        const runner = createOpenAIChatRunner(dependencies);

        expect(runner({
            conversationId: 'conversation-invalid-reference',
            input: {type: 'user_text', text: 'Show me customers'}
        }, (next) => events.push(next), new AbortController().signal)).rejects.toThrow(StructuredResponseError);
        expect(events.some(({type}) => type === 'text.delta' || type === 'ui.block' || type === 'message.completed'))
            .toBeFalse();
        expect(issued).toEqual([]);
    });

    test('rejects a missing block annotation before emitting content or issuing capabilities', async () =>
    {
        const {dependencies, issued} = dependenciesFor([toolRound(), finalRound([table.id], null)]);
        const events: ChatStreamEvent[] = [];
        const runner = createOpenAIChatRunner(dependencies);

        expect(runner({
            conversationId: 'conversation-missing-annotation',
            input: {type: 'user_text', text: 'Show me customers'}
        }, (next) => events.push(next), new AbortController().signal)).rejects.toThrow(StructuredResponseError);
        expect(events.some(({type}) => type === 'text.delta' || type === 'ui.block' || type === 'message.completed'))
            .toBeFalse();
        expect(issued).toEqual([]);
    });
});
