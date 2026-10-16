import {runPresentationBenchmark} from './benchmark.ts';
import {FALLBACK_CONTRACT_VERSION, type FallbackArm, fallbackDecision} from './fallbackContract.ts';
import {FALLBACK_FIXTURES} from './fallbackFixtures.ts';
import {fallbackPrompt, fallbackProtocolFingerprint, gradeFallbackChoice} from './fallbackProtocol.ts';
import {evidenceHash} from './oracle.ts';

export const evaluateFallbackContract = async () =>
{
    const {pairs, report} = await runPresentationBenchmark();
    if (new Set(FALLBACK_FIXTURES.map(({id}) => id)).size !== pairs.length
        || pairs.some(({task}) => !FALLBACK_FIXTURES.some(({id}) => id === task.id))) throw new Error('Fallback fixture coverage drift');
    const cases = FALLBACK_FIXTURES.map(({id, context}) =>
    {
        const pair = pairs.find(({task}) => task.id === id)!;
        const arms = (['baseline', 'candidate'] as FallbackArm[]).map((arm) =>
        {
            const decision = fallbackDecision(context, arm);
            return {arm, ...decision, promptFingerprint: evidenceHash(fallbackPrompt(pair, arm)),
                referenceGrades: decision.eligible.map((representation) => ({representation,
                    ...gradeFallbackChoice(pair, context, arm, JSON.stringify({representation}))}))};
        });
        return {id, context, evidenceFingerprint: evidenceHash(pair.evidence), arms};
    });
    return {version: FALLBACK_CONTRACT_VERSION, protocolFingerprint: fallbackProtocolFingerprint(),
        caseFingerprint: evidenceHash(cases.map(({id, context, evidenceFingerprint}) => ({id, context, evidenceFingerprint}))),
        originalProtocol: 'nlui-034-selection-2026-10-16-v1', originalScoresUnchanged: {baseline: 13, candidate: 16, denominator: 16},
        dataset: report.dataset, cases,
        accounting: {providerRequests: 0, usage: 'not_applicable', monetaryCost: 'not_applicable', createdBudget: false},
        qualification: {referenceOnly: true, liveVerification: 'pending_new_authorization', heldOutReplication: 'not_preregistered',
            humanStudy: 'not_run', promoted: false,
            boundary: 'Post-pilot protocol correction on reused development fixtures, not regrading live outputs or proving model comprehension. A future held-out/repeated study needs its own preregistration and approved cap.'}};
};
