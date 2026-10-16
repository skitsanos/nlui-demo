import type {SelectionAttempt} from './liveAttempt.ts';
import type {SelectionArm} from './liveProtocol.ts';

export const selectionPilotReport = (attempts: SelectionAttempt[], accounting: unknown, manifest: unknown, caseIds: string[]) =>
{
    const arm = (name: SelectionArm) =>
    {
        const rows = attempts.filter(({arm}) => arm === name);
        const completed = rows.filter(({outcome}) => outcome === 'completed');
        const choiceFailures = completed.filter(({choice}) => choice && !choice.eligible);
        return {planned: 16, reserved: rows.length, completed: completed.length,
            passed: completed.filter(({choice}) => choice?.passed).length,
            selectionErrors: choiceFailures.length, invalidOutput: choiceFailures.filter(({choice}) => choice?.errors.includes('invalid_choice')).length,
            contentFailures: completed.filter(({choice}) => choice?.eligible && !choice.contentVerified).length,
            incomplete: rows.filter(({outcome}) => outcome === 'incomplete').length,
            requestErrors: rows.filter(({outcome}) => ['error', 'timeout', 'cancelled', 'interrupted'].includes(outcome)).length,
            usageKnown: rows.filter(({usage}) => !!usage).length,
            infographicSelections: completed.filter(({choice}) => choice?.representation?.startsWith('infographic:')).length,
            inappropriateInfographics: choiceFailures.filter(({choice}) => choice?.representation?.startsWith('infographic:')).length,
            totalRequestMs: rows.reduce((sum, row) => sum + (row.durationMs ?? 0), 0),
            meanKnownRequestMs: rows.some(({durationMs}) => durationMs !== null)
                ? rows.reduce((sum, row) => sum + (row.durationMs ?? 0), 0) / rows.filter(({durationMs}) => durationMs !== null).length : null,
            repairs: 0, executedFallbacks: 0};
    };
    const pairs = caseIds.map((caseId) =>
    {
        const baseline = attempts.find((r) => r.caseId === caseId && r.arm === 'baseline');
        const candidate = attempts.find((r) => r.caseId === caseId && r.arm === 'candidate');
        return {caseId, baseline: baseline?.choice?.representation ?? null, candidate: candidate?.choice?.representation ?? null,
            baselinePassed: baseline?.choice?.passed ?? false, candidatePassed: candidate?.choice?.passed ?? false,
            complete: baseline?.outcome === 'completed' && candidate?.outcome === 'completed'};
    });
    const completedPairs = pairs.filter(({complete}) => complete);
    return {manifest, providerAccounting: accounting, accounting: {planned: 32, reserved: attempts.length, unattempted: 32 - attempts.length,
        responsesWithKnownUsage: attempts.filter(({usage}) => !!usage).length,
        unknownUsageReservations: attempts.filter(({usage}) => !usage).length,
        totalOutputBytes: attempts.reduce((sum, row) => sum + (row.outputBytes ?? 0), 0),
        totalResponseBytes: attempts.reduce((sum, row) => sum + (row.responseBytes ?? 0), 0),
        monetaryCost: {status: 'unpriced', reason: 'No matching versioned provider prices were supplied. Unknown usage is not zero or free.'}},
    arms: {baseline: arm('baseline'), candidate: arm('candidate')}, paired: {
        completed: completedPairs.length,
        bothPass: completedPairs.filter((r) => r.baselinePassed && r.candidatePassed).length,
        baselineOnly: completedPairs.filter((r) => r.baselinePassed && !r.candidatePassed).length,
        candidateOnly: completedPairs.filter((r) => !r.baselinePassed && r.candidatePassed).length,
        neither: completedPairs.filter((r) => !r.baselinePassed && !r.candidatePassed).length, cases: pairs},
    attempts, complete: attempts.length === 32 && attempts.every(({outcome}) => outcome === 'completed'),
    promotion: {promoted: false, reason: 'One paired selection per task is a bounded pilot, not model superiority, general NLUI reliability or human benefit.'},
    scope: {selectionOnly: true, sqlOrToolSelection: false, modelGeneratedCaptionQuality: false, humanStudy: 'not_run',
        noCrossModelComparison: true, modelValuesRedacted: true, latencyBoundary: 'One nonstreaming provider request; no browser or participant task time.'}};
};
