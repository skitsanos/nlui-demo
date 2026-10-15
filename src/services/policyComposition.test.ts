import {describe, expect, test} from 'bun:test';
import type {ResponseCreateParamsStreaming, ResponseStreamEvent} from 'openai/resources/responses/responses';
import {isolatedToolFixture} from '../../tests/helpers/toolFixture.ts';
import {POLICY_CAPTIONS, policyCaptions, type ResponsePolicy} from '../nlui/responsePolicy.ts';
import type {ChatStreamEvent, NluiBlock} from '../nlui/types.ts';
import {createOpenAIChatRunner} from './openaiChatRunner.ts';
import {resolveStructuredResponse, responseTextConfigFor} from './structuredResponse.ts';

const execute = isolatedToolFixture();
const stream = (events: unknown[]) => (async function* ()
{for (const event of events) yield event as ResponseStreamEvent;})();
const terminal = (id: string) => ({type: 'response.completed', response: {id, model: 'fixture-model', usage: null}});
const cases = [
    {policy: 'address_after_dispatch', name: 'search_policies', args: {query: 'change shipping address', limit: 3, topic: 'address_after_dispatch'}},
    {policy: 'delivered_cancellation', name: 'get_order', args: {order_number: 'ORD-1042', intent: 'cancel'}}
] as const;

const compose = (fixture: typeof cases[number], mode: string, caption = POLICY_CAPTIONS[fixture.policy][0]!) =>
{
    const requests: ResponseCreateParamsStreaming[] = [];
    const emitted: ChatStreamEvent[] = [];
    let blocks: NluiBlock[] = [];
    const runner = createOpenAIChatRunner({model: 'fixture-model', issueCapabilities: () => {},
        executeTool: async (name, args, signal) =>
        {
            const result = await execute(name, args, signal);
            blocks = result.blocks;
            expect(result.responsePolicy).toBe(fixture.policy);
            return result;
        },
        createResponse: async (request) =>
        {
            requests.push(request);
            const id = `round-${requests.length}`;
            const created = {type: 'response.created', response: {id, model: 'fixture-model'}};
            if (requests.length === 1) return stream([created, {type: 'response.output_item.done', item: {
                type: 'function_call', call_id: 'policy-call', name: fixture.name, arguments: JSON.stringify(fixture.args)
            }}, terminal(id)]);
            if (mode === 'refusal') return stream([created, {type: 'response.refusal.delta', delta: caption}, terminal(id)]);
            return stream([created, {type: 'response.output_text.delta', delta: JSON.stringify({
                presentation: 'blocks', answer: null, caption: mode === 'unsafe' ? `${caption} I can do it anyway.` : caption,
                block_ids: blocks.map(({id}) => id)
            })}, terminal(id)]);
        }});
    return {requests, emitted, run: () => runner({conversationId: 'policy-composition-fixture',
        input: {type: 'user_text', text: 'Check the requested policy'}}, (event) => emitted.push(event), new AbortController().signal)};
};

describe('policy captions through real tools and the structured provider boundary', () =>
{
    test('freezes the bounded refusal semantics independently of schema and grader consumption', () =>
    {
        expect(POLICY_CAPTIONS).toEqual({
            address_after_dispatch: [
                'An address can change only while an order is processing, before dispatch. This workflow cannot redirect an in-transit or delivered shipment.',
                'Once a shipment is in transit or delivered, its address cannot be changed here. Address changes are only available before dispatch, while processing.'
            ],
            delivered_cancellation: [
                'Delivered orders cannot be cancelled. I can help you check the return options instead.',
                'This order has already been delivered, so cancellation is unavailable. We can look at return eligibility instead.'
            ]
        });
    });
    for (const fixture of cases)
    {
        test.each([...POLICY_CAPTIONS[fixture.policy]])(`publishes ${fixture.policy} approved wording only: %s`, async (caption) =>
        {
            const {run, requests, emitted} = compose(fixture, 'valid', caption);
            const result = await run();
            expect(result.text).toBe(caption);
            expect(result.tools[0]?.responsePolicy).toBe(fixture.policy);
            const format = requests[1]!.text!.format as unknown as {schema: {properties: {caption: {enum: string[]}}}};
            expect(format.schema.properties.caption.enum).toEqual([...POLICY_CAPTIONS[fixture.policy]]);
            expect(emitted.filter(({type}) => type === 'text.delta')).toEqual([{type: 'text.delta', delta: caption}]);
            expect(emitted.some(({type}) => type === 'message.completed')).toBeTrue();
        });
        test.each(['unsafe', 'refusal'])(`rejects ${fixture.policy} bypass before publishing: %s`, async (mode) =>
        {
            const {run, emitted} = compose(fixture, mode);
            await expect(run()).rejects.toThrow();
            expect(emitted.some(({type}) => ['text.delta', 'ui.block', 'message.completed'].includes(type))).toBeFalse();
        });
    }

    test('composes both constraints deterministically, keeps schema/resolver identical and rejects unknown metadata', () =>
    {
        const policies: ResponsePolicy[] = ['delivered_cancellation', 'address_after_dispatch', 'delivered_cancellation'];
        const captions = policyCaptions(policies);
        expect(captions).toHaveLength(4);
        expect(captions.every((caption) => caption.length <= 280)).toBeTrue();
        const format = responseTextConfigFor([], policies).format as unknown as {schema: {properties: {answer: {enum: string[]}}}};
        expect(format.schema.properties.answer.enum).toEqual(captions);
        for (const answer of captions)
        {
            expect(resolveStructuredResponse(JSON.stringify({presentation: 'message', answer, caption: null, block_ids: []}), [], policies).text).toBe(answer);
        }
        expect(() => resolveStructuredResponse(JSON.stringify({presentation: 'message', answer: 'Do it', caption: null, block_ids: []}), [], policies)).toThrow();
        expect(() => policyCaptions(['unknown' as ResponsePolicy])).toThrow();
    });

    test('does not constrain ordinary order lookups or unrelated policy topics', async () =>
    {
        expect((await execute('get_order', JSON.stringify({order_number: 'ORD-1042', intent: 'lookup'}))).responsePolicy).toBeUndefined();
        expect((await execute('get_order', JSON.stringify({order_number: 'ORD-1176', intent: 'cancel'}))).responsePolicy).toBeUndefined();
        expect((await execute('search_policies', JSON.stringify({query: 'delivery delay', limit: 3, topic: 'general'}))).responsePolicy).toBeUndefined();
        expect(policyCaptions([])).toEqual([]);
    });
});
