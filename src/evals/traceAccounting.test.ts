import {describe, expect, test} from 'bun:test';
import type {ResponseStreamEvent} from 'openai/resources/responses/responses';
import {emptyTokenUsage} from '../services/chatTrace.ts';
import {createOpenAIChatRunner} from '../services/openaiChatRunner.ts';
import {createOpenAIExecutor} from './openaiExecutor.ts';
import {traceAccounting} from './reportAccounting.ts';
import {runEvaluationSuite} from './run.ts';
import type {EvaluationScenario} from './scenario.ts';

const scenario: EvaluationScenario = {id: 'trace-accounting', category: 'analytics', prompt: 'Count customers',
    expectedTools: [], expectedBlocks: ['markdown'], mustNotInvoke: [], dataAssertions: ['claim'],
    deterministicAssertions: [{source: 'assistant_text', label: 'claim', operator: 'contains_ci', expected: 'Safe answer'}]};
const event = (value: unknown) => value as ResponseStreamEvent;
const response = (type: string, id = 'response', usage: unknown = null) => event({type,
    response: {id, model: 'fixture', status: type === 'response.completed' ? 'completed' : undefined, usage}});
const call = (id = 'call', args = '{}') => event({type: 'response.output_item.done', item: {
    type: 'function_call', call_id: id, name: 'query_dataset', arguments: args}});
const answer = () => event({type: 'response.output_text.delta', delta: JSON.stringify({
    presentation: 'message', answer: 'Safe answer', caption: null, block_ids: []})});
const signal = () => new AbortController().signal;
const usage = {input_tokens: 10, output_tokens: 2, total_tokens: 12};

describe('complete partial/failure trace accounting', () =>
{
    test.each([
        ['truncated', [response('response.created')]],
        ['incomplete', [response('response.created'), response('response.incomplete', 'response', usage)]],
        ['error', [response('response.created'), response('response.failed', 'response', usage)]]
    ] as const)('retains the provider attempt for %s streams', async (expected, events) =>
    {
        const runner = createOpenAIChatRunner({model: 'fixture', issueCapabilities: () => undefined,
            executeTool: async () => ({modelOutput: {}, blocks: []}), createResponse: async () =>
                (async function* () {for (const item of events) yield item;})()});
        const trace = await createOpenAIExecutor({chatRunner: runner})({scenario, runId: 'r', signal: signal()});
        expect(trace.providerRounds).toHaveLength(1);
        expect(trace.providerRounds![0]!.outcome).toBe(expected);
        expect(trace.providerRounds![0]!.usageKnown).toBe(expected !== 'truncated');
        expect(traceAccounting(trace).usageCoverage).toBe(expected === 'truncated' ? 'partial' : 'complete');
        if (expected !== 'truncated') expect(trace.usage?.totalTokens).toBe(12);
        expect(trace.error).toBeDefined();
    });

    test('records a provider connection failure even before a response ID exists', async () =>
    {
        const runner = createOpenAIChatRunner({model: 'fixture', issueCapabilities: () => undefined,
            executeTool: async () => ({modelOutput: {}, blocks: []}), createResponse: async () => {throw new Error('Connection failed');}});
        const trace = await createOpenAIExecutor({chatRunner: runner})({scenario, runId: 'r', signal: signal()});
        expect(trace.providerRounds![0]).toMatchObject({responseId: '', usageKnown: false, outcome: 'error'});
        expect(trace.responseIds).toEqual([]);
    });

    test('retains thrown tool attempts and already reported usage', async () =>
    {
        const runner = createOpenAIChatRunner({model: 'fixture', issueCapabilities: () => undefined,
            executeTool: async () => {throw new Error('Tool failed');}, createResponse: async () =>
                (async function* () {yield response('response.created'); yield call(); yield response('response.completed', 'response', usage);})()});
        const trace = await createOpenAIExecutor({chatRunner: runner})({scenario, runId: 'r', signal: signal()});
        expect(trace.toolExecutions![0]).toMatchObject({name: 'query_dataset', outcome: 'error', rejected: true, attempt: 1});
        expect(trace.usage?.totalTokens).toBe(12);
    });

    test('accounts rejected policy, repair hashes, empty results and cached replay without extra execution', async () =>
    {
        const rounds = [[call('bad')], [call('good')], [call('good')], [answer()]];
        let attempts = 0;
        const hash = 'a'.repeat(64);
        const runner = createOpenAIChatRunner({model: 'fixture', issueCapabilities: () => undefined,
            executeTool: async () => ++attempts === 1 ? {modelOutput: {ok: false, error: 'SQL_POLICY: rejected'}, blocks: []}
                : {modelOutput: {ok: true}, traceOutput: {queryHash: hash, planHash: hash, returnedRowCount: 0}, blocks: []},
            createResponse: async () => (async function* ()
            {
                const items = rounds.shift()!;
                const id = `r-${rounds.length}`;
                yield response('response.created', id);
                for (const item of items) yield item;
                yield response('response.completed', id, usage);
            })()});
        const trace = await createOpenAIExecutor({chatRunner: runner})({scenario, runId: 'r', signal: signal()});
        expect(trace.outcome).toBe('completed');
        expect(attempts).toBe(2);
        expect(trace.toolExecutions!.map(({attempt}) => attempt)).toEqual([1, 2, 2]);
        expect(traceAccounting(trace)).toMatchObject({toolAttempts: 2, rejectedAttempts: 1, cacheReplays: 1, emptyResults: 1});
        expect(trace.toolExecutions![0]!.policyCode).toBe('SQL_POLICY');
        expect(trace.toolExecutions![1]!.queryHash).toBe(hash);
    });

    test('refuses cache identity reuse with different arguments', async () =>
    {
        let round = 0;
        let executions = 0;
        const runner = createOpenAIChatRunner({model: 'fixture', issueCapabilities: () => undefined,
            executeTool: async () => {executions++; return {modelOutput: {}, blocks: []};},
            createResponse: async () => (async function* ()
            {
                const id = `r-${round++}`;
                yield response('response.created', id); yield call('same-id', round === 1 ? '{}' : '{"changed":true}');
                yield response('response.completed', id);
            })()});
        const trace = await createOpenAIExecutor({chatRunner: runner})({scenario, runId: 'r', signal: signal()});
        expect(executions).toBe(1);
        expect(trace.error).toContain('changed its name or arguments');
    });

    test('times out a non-cooperative runner without losing checkpoints or accepting late events', async () =>
    {
        let release: (() => void) | undefined;
        const executor = createOpenAIExecutor({chatRunner: async (_request, emit, _signal, observe) =>
        {
            observe?.({type: 'round.completed', round: {round: 1, responseId: 'one', model: 'fixture', durationMs: 1,
                usage: {...emptyTokenUsage(), inputTokens: 10, totalTokens: 10}, usageKnown: true}});
            await new Promise<void>((resolve) => {release = resolve;});
            emit({type: 'message.completed', messageId: 'late', responseId: 'late'});
            return undefined;
        }});
        const report = await runEvaluationSuite({scenarios: [scenario], executor, timeoutMs: 25});
        expect(report.results[0]!.trace.outcome).toBe('timeout');
        expect(report.results[0]!.usage?.totalTokens).toBe(10);
        expect(report.summary.errors).toBe(1);
        release?.();
        await Promise.resolve();
        expect(report.results[0]!.trace.responseIds).not.toContain('late');
    });

    test('accounting failure preserves the successful execution evidence', async () =>
    {
        const executor = createOpenAIExecutor({chatRunner: async (_req, emit) =>
        {
            emit({type: 'text.delta', delta: 'Safe answer'});
            emit({type: 'message.completed', messageId: 'm', responseId: 'r'});
            return undefined;
        }});
        const report = await runEvaluationSuite({scenarios: [scenario], executor, usageResolver: async () => {throw new Error('Bad rates');}});
        expect(report.results[0]!.trace.text).toBe('Safe answer');
        expect(report.results[0]!.error).toContain('accounting failed');
    });

    test('bounds a non-cooperative accounting resolver and keeps the completed turn', async () =>
    {
        const executor = createOpenAIExecutor({chatRunner: async (_req, emit) =>
        {
            emit({type: 'text.delta', delta: 'Safe answer'});
            emit({type: 'message.completed', messageId: 'm', responseId: 'r'});
            return undefined;
        }});
        const report = await runEvaluationSuite({scenarios: [scenario], executor, timeoutMs: 25,
            usageResolver: async () => new Promise(() => undefined)});
        expect(report.results[0]!.trace.text).toBe('Safe answer');
        expect(report.results[0]!.trace.outcome).toBe('timeout');
        expect(report.summary.errors).toBe(1);
    });

    test.each([NaN, Infinity, -1])('refuses invalid provider cost %s without losing evidence', async (amount) =>
    {
        const executor = createOpenAIExecutor({chatRunner: async (_req, emit) =>
        {
            emit({type: 'text.delta', delta: 'Safe answer'});
            emit({type: 'message.completed', messageId: 'm', responseId: 'r'});
            return undefined;
        }});
        const report = await runEvaluationSuite({scenarios: [scenario], executor,
            usageResolver: async () => ({cost: {amount, currency: 'USD', source: 'provider'}})});
        expect(report.results[0]!.trace.text).toBe('Safe answer');
        expect(report.summary.cost).toBeUndefined();
        expect(report.summary.errors).toBe(1);
    });

    test('does not infer complete usage from a legacy round without explicit coverage', () =>
    {
        expect(traceAccounting({providerRounds: [{round: 1, responseId: 'r', model: 'fixture',
            durationMs: 1, usage: emptyTokenUsage()}]} as never).usageCoverage).toBe('partial');
    });
});
