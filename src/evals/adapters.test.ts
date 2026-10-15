import {Database} from 'bun:sqlite';
import {describe, expect, test} from 'bun:test';
import {emptyTokenUsage} from '../services/chatTrace.ts';
import {evaluateTrace} from './evaluate.ts';
import {createIsolatedExecutor} from './isolatedExecutor.ts';
import {createOpenAIExecutor} from './openaiExecutor.ts';
import type {EvaluationScenario} from './scenario.ts';
import type {EvaluationTrace} from './types.ts';

const first: EvaluationScenario = {id: 'first', category: 'analytics', prompt: 'Count customers', expectedTools: [],
    expectedBlocks: ['markdown'], mustNotInvoke: [], dataAssertions: ['first'], deterministicAssertions: [
        {source: 'assistant_text', label: 'first', operator: 'contains_ci', expected: 'first'}]};
const next: EvaluationScenario = {...first, id: 'next', prompt: 'Break those down', execution: {mode: 'multi-turn', priorScenarioIds: ['first']}};

describe('isolated trajectories and mutation boundaries', () =>
{
    test('chains prerequisites using one conversation, previous response IDs and complete usage', async () =>
    {
        const requests: Array<{conversationId: string; previousResponseId?: string}> = [];
        const executor = createOpenAIExecutor({scenarios: [first, next], chatRunner: async (request, emit, _signal, observe) =>
        {
            requests.push(request);
            const responseId = `r${requests.length}`;
            observe?.({type: 'round.completed', round: {round: 1, responseId, model: 'fixture', durationMs: 1,
                usage: {...emptyTokenUsage(), inputTokens: 5, totalTokens: 5}}});
            emit({type: 'text.delta', delta: 'first result'});
            emit({type: 'message.completed', messageId: responseId, responseId});
            return undefined;
        }});
        const trace = await executor({scenario: next, runId: 'next:1:test', signal: new AbortController().signal});
        expect(requests).toHaveLength(2);
        expect(requests[0]!.previousResponseId).toBeUndefined();
        expect(requests[1]!.previousResponseId).toBe('r1');
        expect(requests[0]!.conversationId).toBe(requests[1]!.conversationId);
        expect(trace.usage?.totalTokens).toBe(10);
        expect(trace.trajectory?.[0]?.scenarioId).toBe('first');
        expect(trace.latency.firstTextMs).toBeGreaterThanOrEqual(trace.trajectory![0]!.latency.totalMs);
    });
    test('retains prerequisite usage if a later turn times out', async () =>
    {
        let calls = 0;
        const executor = createOpenAIExecutor({scenarios: [first, next], chatRunner: async (_request, emit, _signal, observe) =>
        {
            calls++;
            observe?.({type: 'round.completed', round: {round: 1, responseId: `r${calls}`, model: 'fixture', durationMs: 1,
                usage: {...emptyTokenUsage(), inputTokens: 5, totalTokens: 5}, usageKnown: true}});
            if (calls === 2) await new Promise(() => undefined);
            emit({type: 'message.completed', messageId: 'm', responseId: 'r1'});
            return undefined;
        }});
        const {runEvaluationSuite} = await import('./run.ts');
        const report = await runEvaluationSuite({scenarios: [next], executor, timeoutMs: 25});
        expect(report.results[0]!.trace.outcome).toBe('timeout');
        expect(report.results[0]!.usage?.totalTokens).toBe(10);
        expect(report.results[0]!.accounting?.usageCoverage).toBe('partial');
    });
    test('does not run a target after a failed prerequisite or invent missing prerequisite state', async () =>
    {
        let calls = 0;
        const executor = createOpenAIExecutor({scenarios: [first, next], chatRunner: async () => {calls++; throw new Error('Failed prior');}});
        const trace = await executor({scenario: next, runId: 'r', signal: new AbortController().signal});
        expect(calls).toBe(1);
        expect(trace.scenarioId).toBe('next');
        expect(trace.error).toContain('Failed prior');
        await expect(createOpenAIExecutor({scenarios: []})({scenario: next, runId: 'r', signal: new AbortController().signal}))
            .rejects.toThrow('Missing trajectory prerequisite');
    });
    test.each([false, true])('captures unauthorized mutations and cleans up the owned fixture (throws=%s)', async (throws) =>
    {
        let path = '';
        const executor = createIsolatedExecutor((data) => async ({scenario, runId}) =>
        {
            path = data.databasePath;
            const database = new Database(path);
            database.run("UPDATE orders SET status = 'cancelled' WHERE id = 1176");
            database.close();
            if (throws) throw new Error('Failed after mutation');
            const trace: EvaluationTrace = {traceVersion: 2, outcome: 'completed', scenarioId: scenario.id, runId, text: 'first',
                startedAt: '', completedAt: '', events: [], toolCalls: [], blocks: [], responseIds: [], latency: {totalMs: 1}};
            return trace;
        });
        const trace = await executor({scenario: first, runId: 'r', signal: new AbortController().signal});
        expect(trace.fixture?.unexpectedMutation).toBeTrue();
        expect((await evaluateTrace(first, trace)).status).toBe(throws ? 'error' : 'failed');
        expect(await Bun.file(path).exists()).toBeFalse();
    });

    test('cleans an owned fixture even when an adapter ignores its timeout signal', async () =>
    {
        let path = '';
        const executor = createIsolatedExecutor((data) => async () =>
        {
            path = data.databasePath;
            return new Promise(() => undefined);
        });
        const trace = await executor({scenario: first, runId: 'r', signal: AbortSignal.timeout(25)});
        expect(trace.outcome).toBe('timeout');
        expect(trace.fixture?.unexpectedMutation).toBeFalse();
        expect(await Bun.file(path).exists()).toBeFalse();
    });
});
