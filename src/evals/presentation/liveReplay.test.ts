import {beforeAll, expect, test} from 'bun:test';
import replay from '../../../docs/issues/reviews/assets/2026-10-16-selection-pilot-replay.json';
import {runPresentationBenchmark} from './benchmark.ts';
import {gradeLiveChoice, type SelectionArm, selectionProtocolFingerprint, selectionSchedule} from './liveProtocol.ts';

let benchmark: Awaited<ReturnType<typeof runPresentationBenchmark>>;
beforeAll(async () => {benchmark = await runPresentationBenchmark();});

test('replays every preserved live output against the frozen independent contracts, without a provider', () =>
{
    expect(replay.protocolFingerprint).toBe(selectionProtocolFingerprint());
    expect(replay.caseFingerprint).toBe(benchmark.report.caseFingerprint);
    expect(replay.cases).toHaveLength(32);
    expect(replay.cases.map(({caseId, arm}) => `${caseId}:${arm}`)).toEqual(selectionSchedule(benchmark.pairs).map(({label}) => label));
    const passed = {baseline: 0, candidate: 0}; const failures: string[] = [];
    for (const row of replay.cases)
    {
        const pair = benchmark.pairs.find(({task}) => task.id === row.caseId)!;
        const arm = row.arm as SelectionArm;
        const result = gradeLiveChoice(pair, arm, row.output);
        expect(row.status).toBe('completed'); expect(result.catalogValid).toBeTrue();
        expect(result.passed).toBe(row.expectedPassed);
        if (result.passed) passed[arm]++; else failures.push(`${row.caseId}:${arm}`);
    }
    expect(passed).toEqual({baseline: 13, candidate: 16});
    // Never turn the observed misses into passes by relabelling after seeing the live results.
    expect(failures).toEqual(['order-history:baseline', 'return-policy:baseline', 'missing-order:baseline']);
});

test('preserves complete live token accounting independently of success scores, without pricing missing data', () =>
{
    const sum = (arm: string, key: keyof typeof replay.cases[number]['usage']) => replay.cases
        .filter((row) => row.arm === arm).reduce((n, row) => n + row.usage[key], 0);
    expect(sum('baseline', 'inputTokens')).toBe(7820); expect(sum('candidate', 'inputTokens')).toBe(10140);
    expect(sum('baseline', 'outputTokens')).toBe(1256); expect(sum('candidate', 'outputTokens')).toBe(765);
    expect(sum('baseline', 'reasoningTokens')).toBe(968); expect(sum('candidate', 'reasoningTokens')).toBe(474);
    expect(sum('baseline', 'totalTokens') + sum('candidate', 'totalTokens')).toBe(19981);
    for (const row of replay.cases) expect(row.usage.totalTokens).toBe(row.usage.inputTokens + row.usage.outputTokens);
});
