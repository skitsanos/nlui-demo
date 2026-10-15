import {createHash} from 'node:crypto';
import manifest from '../../data/fixture-manifest.json';
import {SEMANTIC_CATALOG_VERSION} from '../data/semantic/catalog.ts';
import {POLICY_CAPTIONS, RESPONSE_POLICY_VERSION} from '../nlui/responsePolicy.ts';
import {FORM_QUESTION_CRITERIA, PRODUCT_FACT_CRITERIA} from './presentationCriteria.ts';
import type {EvaluationResult, EvaluationTrace} from './types.ts';

export const EVALUATOR_VERSION = 'deterministic-v3-presentation';
export const evaluationVersions = () => ({evaluator: EVALUATOR_VERSION, trace: 2,
    presentationPolicy: RESPONSE_POLICY_VERSION,
    presentationFingerprint: createHash('sha256').update(JSON.stringify({facts: PRODUCT_FACT_CRITERIA,
        questions: FORM_QUESTION_CRITERIA, captions: POLICY_CAPTIONS})).digest('hex'),
    dataset: manifest.datasetVersion, semanticCatalog: SEMANTIC_CATALOG_VERSION,
    fixtureFingerprint: manifest.baselineFingerprint, goldenFixtures: manifest.goldenFixtures});

export const traceAccounting = (trace: EvaluationTrace) =>
{
    const turns = [...trace.trajectory ?? [], trace];
    const rounds = turns.flatMap((turn) => turn.providerRounds ?? []);
    const tools = turns.flatMap((turn) => turn.toolExecutions ?? []);
    return {outcome: trace.outcome ?? (trace.error ? 'error' : 'unverified'),
        usageCoverage: rounds.length === 0 ? 'unavailable'
            : ['timeout', 'cancelled', 'truncated'].includes(trace.outcome ?? '') || rounds.some((round) => round.usageKnown !== true)
                ? 'partial' : 'complete',
        turns: turns.length, providerRounds: rounds.length, toolAttempts: tools.filter(({cached}) => !cached).length,
        cacheReplays: tools.filter(({cached}) => cached).length,
        rejectedAttempts: tools.filter(({rejected, cached}) => rejected && !cached).length,
        emptyResults: tools.filter(({emptyResult, cached}) => emptyResult && !cached).length,
        hashes: tools.map(({callId, queryHash, planHash, policyCode, outcome, attempt}) =>
            ({callId, queryHash, planHash, policyCode, outcome, attempt}))};
};

export const repeatStability = (results: EvaluationResult[]) =>
{
    const ids = [...new Set(results.map(({scenarioId}) => scenarioId))];
    return ids.map((scenarioId) =>
    {
        const runs = results.filter((result) => result.scenarioId === scenarioId);
        const times = runs.map(({latency}) => latency.totalMs);
        const tokenCounts = runs.map(({usage}) => usage?.totalTokens).filter((value): value is number => value !== undefined);
        return {scenarioId, runs: runs.length, statuses: runs.map(({status}) => status),
            stable: runs.every((result) => result.status === runs[0]!.status),
            allPassed: runs.every(({status}) => status === 'passed'), latencyRangeMs: Math.max(...times) - Math.min(...times),
            tokenRange: tokenCounts.length === runs.length ? Math.max(...tokenCounts) - Math.min(...tokenCounts) : null};
    });
};
