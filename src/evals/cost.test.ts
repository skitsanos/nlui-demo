import {describe, expect, test} from 'bun:test';
import {estimateEvaluationCost} from './cost.ts';
import {redactConfiguredValues} from './reportRedaction.ts';
import {runEvaluationSuite} from './run.ts';
import type {EvaluationScenario} from './scenario.ts';
import type {EvaluationTrace} from './types.ts';

// Synthetic test rates only; these are not current provider prices.
const pricing = {version: 'synthetic-test-v1', effectiveAt: '2026-01-01', sourceUrl: 'https://example.test/pricing',
    model: 'fixture-model', inputPerMillion: 2, cachedInputPerMillion: 0.5, outputPerMillion: 8};

describe('attributable, opt-in estimated cost', () =>
{
    test('charges uncached and cached input once and does not double-charge reasoning tokens', () =>
    {
        const estimate = estimateEvaluationCost(pricing, pricing.model,
            {inputTokens: 1000, cachedInputTokens: 200, outputTokens: 500, reasoningTokens: 300});
        expect(estimate.amount).toBeCloseTo(0.0057);
        expect(estimate.basis).toMatchObject({version: 'synthetic-test-v1', sourceUrl: pricing.sourceUrl});
        expect(redactConfiguredValues(estimate, {model: pricing.model})).toMatchObject({basis: {model: '[configured]'}});
    });
    test.each([
        {}, {inputTokens: 100}, {inputTokens: 100, outputTokens: 10},
        {inputTokens: 100, cachedInputTokens: 101, outputTokens: 10},
        {inputTokens: -1, cachedInputTokens: 0, outputTokens: 10},
        {inputTokens: Infinity, cachedInputTokens: 0, outputTokens: 10},
        {inputTokens: 1.5, cachedInputTokens: 0, outputTokens: 10}
    ])('rejects absent, inconsistent or invalid token evidence %j', (usage) =>
    {
        expect(() => estimateEvaluationCost(pricing, pricing.model, usage)).toThrow();
    });
    test('rejects missing source/version, negative rates and wrong model pricing', () =>
    {
        const usage = {inputTokens: 100, cachedInputTokens: 0, outputTokens: 10};
        expect(() => estimateEvaluationCost({...pricing, version: ''}, pricing.model, usage)).toThrow();
        expect(() => estimateEvaluationCost({...pricing, sourceUrl: 'unattributed'}, pricing.model, usage)).toThrow();
        expect(() => estimateEvaluationCost({...pricing, inputPerMillion: -1}, pricing.model, usage)).toThrow();
        expect(() => estimateEvaluationCost({...pricing, inputPerMillion: Number.MAX_VALUE}, pricing.model, usage)).toThrow();
        expect(() => estimateEvaluationCost(pricing, 'another-model', usage)).toThrow('does not match');
    });

    test.each(['valid', 'unattributed', 'partial', 'mixed-model'])('requires complete attributed run evidence: %s', async (kind) =>
    {
        const scenario: EvaluationScenario = {id: 'pricing', category: 'analytics', prompt: 'Count', expectedTools: [],
            expectedBlocks: ['markdown'], mustNotInvoke: [], dataAssertions: []};
        const usage = {inputTokens: 100, cachedInputTokens: 0, outputTokens: 10};
        const trace: EvaluationTrace = {traceVersion: 2, outcome: 'completed', scenarioId: scenario.id, runId: 'r',
            startedAt: '', completedAt: '', events: [], text: 'Count', toolCalls: [], blocks: [], responseIds: [],
            latency: {totalMs: 1}, model: pricing.model, usage, providerRounds: [{round: 1, responseId: 'r',
                model: kind === 'mixed-model' ? 'other' : pricing.model, durationMs: 1, usage: {...usage,
                    cacheWriteTokens: 0, reasoningTokens: 0, totalTokens: 110}, usageKnown: kind !== 'partial'}]};
        const cost = estimateEvaluationCost(pricing, pricing.model, usage);
        if (kind === 'unattributed') delete cost.basis;
        const report = await runEvaluationSuite({scenarios: [scenario], executor: async () => trace,
            usageResolver: async () => ({usage, cost})});
        expect(report.summary.errors).toBe(kind === 'valid' ? 0 : 1);
        expect(report.summary.cost?.amount).toBe(kind === 'valid' ? cost.amount : undefined);
        expect(report.results[0]!.trace.text).toBe('Count');
    });
});
