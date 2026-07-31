import {describe, expect, test} from 'bun:test';
import type {ChatRequest, ChatStreamEvent} from '../nlui/types.ts';
import {createOpenAIExecutor} from './openaiExecutor.ts';
import type {EvaluationScenario} from './scenario.ts';

const scenario: EvaluationScenario = {
    id: 'analytics-executor',
    category: 'analytics',
    prompt: 'Count customers',
    expectedTools: ['query_dataset'],
    expectedBlocks: ['metrics', 'markdown'],
    mustNotInvoke: [],
    dataAssertions: ['count is exact']
};

describe('OpenAI scenario executor', () =>
{
    test('records a provider-independent stream without making a live request', async () =>
    {
        let request: ChatRequest | undefined;
        const chatRunner = async (
            nextRequest: ChatRequest,
            emit: (event: ChatStreamEvent) => void
        ): Promise<undefined> =>
        {
            request = nextRequest;
            emit({type: 'message.started', messageId: 'message-1'});
            emit({type: 'tool.started', name: 'query_dataset'});
            emit({type: 'ui.block', block: {
                id: 'count',
                type: 'stats',
                items: [{label: 'Customers', value: 200}]
            }});
            emit({type: 'tool.completed', name: 'query_dataset'});
            emit({type: 'text.delta', delta: 'There are 200 customers.'});
            emit({type: 'message.completed', messageId: 'message-1', responseId: 'response-1'});
            return undefined;
        };
        const executor = createOpenAIExecutor({chatRunner});
        const trace = await executor({
            scenario,
            runId: 'run-1',
            signal: new AbortController().signal
        });

        expect(request?.input).toEqual({type: 'user_text', text: scenario.prompt});
        expect(request?.conversationId.startsWith('eval-')).toBeTrue();
        expect(trace.toolCalls).toEqual(['query_dataset']);
        expect(trace.blocks).toHaveLength(1);
        expect(trace.text).toBe('There are 200 customers.');
        expect(trace.responseIds).toEqual(['response-1']);
        expect(trace.events.map(({sequence}) => sequence)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    test('does not synthesize stateful scenario setup', async () =>
    {
        const executor = createOpenAIExecutor({
            chatRunner: async () => { throw new Error('should not run'); }
        });
        expect(executor({
            scenario: {
                ...scenario,
                setup: {
                    pendingAction: {
                        type: 'cancel_order',
                        orderNumber: 'ORD-1176',
                        reason: 'Duplicate order'
                    }
                }
            },
            runId: 'run-setup',
            signal: new AbortController().signal
        })).rejects.toThrow('isolated setup adapter');
    });

    test('captures internal tool output and provider usage for deterministic grading', async () =>
    {
        const executor = createOpenAIExecutor({
            chatRunner: async (_request, emit) =>
            {
                emit({type: 'tool.started', name: 'query_dataset'});
                emit({type: 'tool.completed', name: 'query_dataset'});
                return {
                    messageId: 'message-1',
                    responseId: 'response-1',
                    model: 'test-model',
                    promptVersion: 'test-prompt',
                    text: '',
                    blocks: [],
                    tools: [{
                        round: 1,
                        callId: 'call-1',
                        name: 'query_dataset',
                        arguments: {sql: 'SELECT COUNT(*) AS customer_count FROM customers'},
                        modelOutput: {rows: [{customer_count: 200}]},
                        candidateBlockIds: ['customers'],
                        candidateBlockTypes: ['stats'],
                        durationMs: 3,
                        cached: false,
                        rejected: false
                    }],
                    rounds: [],
                    usage: {
                        inputTokens: 10,
                        cachedInputTokens: 2,
                        cacheWriteTokens: 0,
                        outputTokens: 5,
                        reasoningTokens: 1,
                        totalTokens: 15
                    },
                    durationMs: 20
                };
            }
        });
        const trace = await executor({scenario, runId: 'run-traced', signal: new AbortController().signal});
        expect(trace.toolExecutions?.[0]?.modelOutput).toEqual({rows: [{customer_count: 200}]});
        expect(trace.model).toBe('test-model');
        expect(trace.usage?.cachedInputTokens).toBe(2);
    });

    test('retains completed-round usage when a later provider round fails', async () =>
    {
        const executor = createOpenAIExecutor({
            chatRunner: async (_request, _emit, _signal, observe) =>
            {
                observe?.({
                    type: 'round.completed',
                    round: {
                        round: 1,
                        responseId: 'response-1',
                        model: 'test-model',
                        durationMs: 10,
                        usage: {
                            inputTokens: 20,
                            cachedInputTokens: 0,
                            cacheWriteTokens: 0,
                            outputTokens: 4,
                            reasoningTokens: 0,
                            totalTokens: 24
                        }
                    }
                });
                throw new Error('provider failed on round two');
            }
        });
        const trace = await executor({scenario, runId: 'run-failed', signal: new AbortController().signal});
        expect(trace.error).toBe('provider failed on round two');
        expect(trace.responseIds).toEqual(['response-1']);
        expect(trace.usage?.totalTokens).toBe(24);
    });
});
