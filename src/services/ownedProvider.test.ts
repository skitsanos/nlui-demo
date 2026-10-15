import {expect, test} from 'bun:test';
import type {ResponseCreateParamsStreaming, ResponseStreamEvent} from 'openai/resources/responses/responses';
import type {ChatStreamEvent} from '../nlui/types.ts';
import {createOpenAIChatRunner} from './openaiChatRunner.ts';
import {publicChatStreamEvent} from './publicChatStream.ts';

test('owned provider adapter replays bounded domain history and complete within-turn output without provider chaining', async () =>
{
    const requests: ResponseCreateParamsStreaming[] = []; const events: ChatStreamEvent[] = [];
    const call = {type: 'function_call', id: 'fc', call_id: 'call', name: 'query_dataset', arguments: '{"sql":"SELECT COUNT(*) AS n FROM customers"}', status: 'completed'};
    const reasoning = {type: 'reasoning', id: 'rs', summary: [], encrypted_content: 'opaque-private-reasoning'};
    const runner = createOpenAIChatRunner({model: 'fixture', history: [{role: 'user', content: 'Count customers'}, {role: 'assistant', content: 'A previous verified answer.'}],
        createResponse: async (params) =>
        {
            requests.push(params); const first = requests.length === 1;
            return (async function* ()
            {
                yield {type: 'response.created', response: {id: first ? 'provider-one' : 'provider-two', model: 'fixture'}} as ResponseStreamEvent;
                if (first) yield {type: 'response.output_item.done', item: call} as ResponseStreamEvent;
                else yield {type: 'response.output_text.delta', delta: JSON.stringify({presentation: 'message', answer: 'There are two customers.', caption: null, block_ids: []})} as ResponseStreamEvent;
                yield {type: 'response.completed', response: {id: first ? 'provider-one' : 'provider-two', model: 'fixture', status: 'completed', usage: null,
                    output: first ? [reasoning, call] : []}} as unknown as ResponseStreamEvent;
            })();
        }, executeTool: async () => ({modelOutput: {customer_count: 2}, blocks: []}), issueCapabilities: () => undefined});
    await runner({conversationId: 'owned-conversation', previousResponseId: 'APPLICATION_CURSOR_NOT_PROVIDER', input: {type: 'user_text', text: 'Count them again'}},
        (event) => {const projected = publicChatStreamEvent(event); if (projected) events.push(projected);}, new AbortController().signal);
    expect(requests).toHaveLength(2);
    for (const request of requests) {expect(request.store).toBeFalse(); expect(request.previous_response_id).toBeUndefined();}
    expect(JSON.stringify(requests[0]!.input)).toContain('A previous verified answer.');
    expect(JSON.stringify(requests[1]!.input)).toContain('opaque-private-reasoning');
    expect(JSON.stringify(requests[1]!.input)).toContain('function_call_output');
    expect(JSON.stringify(events)).not.toContain('opaque-private-reasoning');
    expect(JSON.stringify(events)).not.toContain('SELECT');
    expect(events.at(-1)?.type).toBe('message.completed');
});
