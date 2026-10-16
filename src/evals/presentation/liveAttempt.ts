import type {Response as ProviderResponse} from 'openai/resources/responses/responses';
import type {ProviderRequestBudget} from '../../research/budget.ts';
import type {MatchedPresentation} from './benchmark.ts';
import type {SelectionJournal} from './liveJournal.ts';
import {gradeLiveChoice, type SelectionArm, selectionRequest} from './liveProtocol.ts';
import {type SelectionProvider, selectionOutput, selectionUsage} from './liveProvider.ts';
import {evidenceHash} from './oracle.ts';

export interface SelectionResponseRecord
{
    body: ProviderResponse; startedAt: string; finishedAt: string; durationMs: number;
    responseModelFingerprint: string | null; responseBytes: number;
}
export interface SelectionAttempt
{
    slot: number; reservation: number; caseId: string; arm: SelectionArm;
    outcome: 'completed' | 'incomplete' | 'error' | 'timeout' | 'cancelled' | 'interrupted';
    choice: ReturnType<typeof gradeLiveChoice> | null;
    usage: ReturnType<typeof selectionUsage>;
    durationMs: number | null; responseId: string | null; responseModelFingerprint: string | null;
    outputBytes: number | null; responseBytes: number | null; recovered: boolean;
    error?: unknown;
}
export const attemptName = (slot: number, kind: 'request' | 'response' | 'result') => `attempt-${String(slot).padStart(2, '0')}-${kind}.json`;
export const responseAttempt = (record: SelectionResponseRecord, pair: MatchedPresentation, arm: SelectionArm, slot: number, reservation: number,
    budget: ProviderRequestBudget, recovered = false): SelectionAttempt =>
{
    const usage = selectionUsage(record.body); const encoded = selectionOutput(record.body);
    if (usage) budget.account(reservation, {round: 1, responseId: record.body.id, model: '', durationMs: record.durationMs, usage, usageKnown: true});
    return {slot, reservation, caseId: pair.task.id, arm, outcome: record.body.status === 'completed' ? 'completed' : 'incomplete',
        choice: record.body.status === 'completed' ? gradeLiveChoice(pair, arm, encoded) : null, usage, durationMs: record.durationMs,
        responseId: record.body.id, responseModelFingerprint: record.responseModelFingerprint, outputBytes: Buffer.byteLength(encoded),
        responseBytes: record.responseBytes, recovered};
};
export const executeSelectionAttempt = async (pair: MatchedPresentation, arm: SelectionArm, slot: number, reservation: number,
    journal: SelectionJournal, budget: ProviderRequestBudget, provider: SelectionProvider, signal: AbortSignal): Promise<SelectionAttempt> =>
{
    const request = selectionRequest(pair, arm); const startedAt = new Date().toISOString(); const started = performance.now();
    journal.write(attemptName(slot, 'request'), {slot, reservation, caseId: pair.task.id, arm, startedAt, request});
    let record: SelectionResponseRecord | undefined;
    try
    {
        const body = await provider(request, AbortSignal.any([signal, AbortSignal.timeout(45_000)]));
        record = {body, startedAt, finishedAt: new Date().toISOString(), durationMs: performance.now() - started,
            responseModelFingerprint: body.model ? evidenceHash(body.model) : null, responseBytes: Buffer.byteLength(JSON.stringify(body))};
    }
    catch (error)
    {
        const info = error as {message?: string; status?: number; code?: string; name?: string};
        const result: SelectionAttempt = {slot, reservation, caseId: pair.task.id, arm,
            outcome: signal.aborted ? 'cancelled' : /timeout/i.test(info.name ?? '') ? 'timeout' : 'error', choice: null,
            usage: null, durationMs: performance.now() - started, responseId: null, responseModelFingerprint: null,
            outputBytes: null, responseBytes: null, recovered: false,
            error: journal.sanitize({message: info.message ?? 'Provider request failed.', status: info.status, code: info.code})};
        journal.write(attemptName(slot, 'result'), result); return result;
    }
    // Persist the received response BEFORE grading/accounting. A disk/grading failure is not a retryable API failure.
    journal.write(attemptName(slot, 'response'), record);
    const result = responseAttempt(record, pair, arm, slot, reservation, budget);
    journal.write(attemptName(slot, 'result'), result); return result;
};
