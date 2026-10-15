import {describe, expect, test} from 'bun:test';
import type {ResponseStreamEvent} from 'openai/resources/responses/responses';
import {createOpenAIChatRunner, type OpenAIChatDependencies} from './openaiChatRunner.ts';

const request = {conversationId: 'cancel-test', input: {type: 'user_text' as const, text: 'Help me'}};
const event = (value: unknown): ResponseStreamEvent => value as ResponseStreamEvent;
const completedTool = [event({type: 'response.created', response: {id: 'response-one', model: 'test-model'}}),
    event({type: 'response.output_item.done', item: {type: 'function_call', call_id: 'call-one', name: 'query_dataset', arguments: '{}'}}),
    event({type: 'response.completed', response: {id: 'response-one', status: 'completed', model: 'test-model'}})];

describe('provider and tool cancellation propagation', () =>
{
    test.each(['setup', 'iterator', 'tool'])('stalled %s settles on abort without publishing or another provider round', async (phase) =>
    {
        const controller = new AbortController();
        let providerCalls = 0;
        let issued = 0;
        let observedSignal: AbortSignal | undefined;
        const dependencies: OpenAIChatDependencies = {
            model: 'test-model',
            createResponse: async (_params, signal) =>
            {
                providerCalls += 1;
                if (phase === 'setup')
                {
                    observedSignal = signal;
                    queueMicrotask(() => controller.abort());
                    return new Promise(() => undefined);
                }
                return (async function* ()
                {
                    if (phase === 'iterator')
                    {
                        observedSignal = signal;
                        queueMicrotask(() => controller.abort());
                        await new Promise(() => undefined);
                    }
                    for (const item of completedTool) yield item;
                })();
            },
            executeTool: async (_name, _args, signal) =>
            {
                observedSignal = signal;
                queueMicrotask(() => controller.abort());
                return new Promise(() => undefined);
            },
            issueCapabilities: () => {issued += 1;}
        };
        const events: string[] = [];
        await expect(createOpenAIChatRunner(dependencies)(request, (item) => events.push(item.type), controller.signal)).rejects.toThrow();
        expect(observedSignal).toBe(controller.signal);
        expect(providerCalls).toBe(1);
        expect(issued).toBe(0);
        expect(events).not.toContain('message.completed');
        expect(events).not.toContain('ui.block');
    });
});
