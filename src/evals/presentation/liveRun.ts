import {existsSync, lstatSync} from 'node:fs';
import {join} from 'node:path';
import {ProviderRequestBudget} from '../../research/budget.ts';
import type {EvaluationRedactionConfig} from '../reportRedaction.ts';
import type {runPresentationBenchmark} from './benchmark.ts';
import {attemptName, executeSelectionAttempt, responseAttempt, type SelectionAttempt, type SelectionResponseRecord} from './liveAttempt.ts';
import {SelectionJournal} from './liveJournal.ts';
import {SELECTION_PILOT_ID, SELECTION_PILOT_MAXIMUM, selectionInput, selectionProtocolFingerprint, selectionSchedule} from './liveProtocol.ts';
import type {SelectionProvider} from './liveProvider.ts';
import {selectionPilotReport} from './liveReport.ts';
import {evidenceHash} from './oracle.ts';

export const runSelectionPilot = async ({benchmark, root, configuration, provider, signal = new AbortController().signal, onProgress = () => {}, evidenceKind = 'injected_test', dependencyFingerprint = 'injected_test'}: {
    benchmark: Awaited<ReturnType<typeof runPresentationBenchmark>>; root: string; configuration: Required<EvaluationRedactionConfig>;
    provider: SelectionProvider; signal?: AbortSignal; onProgress?: (attempt: SelectionAttempt) => void;
    evidenceKind?: 'injected_test' | 'live_provider';
    dependencyFingerprint?: string;
}) =>
{
    const {pairs, report: reference} = benchmark;
    const schedule = selectionSchedule(pairs);
    if (schedule.length !== 32 || new Set(schedule.map(({label}) => label)).size !== 32 || !reference.dataset.unchanged
        || reference.summary.baselineReferenceFailures || reference.summary.candidateReferenceFailures) throw new Error('Frozen reference preflight failed.');
    if (evidenceKind === 'live_provider' && !/^[a-f0-9]{64}$/.test(dependencyFingerprint)) throw new Error('Live dependency fingerprint required.');
    const manifest = {id: SELECTION_PILOT_ID, approvalDate: '2026-10-16', maximumAttempts: SELECTION_PILOT_MAXIMUM,
        evidenceKind, protocolFingerprint: selectionProtocolFingerprint(), caseFingerprint: reference.caseFingerprint,
        fixtureFingerprint: reference.dataset.before, modelFingerprint: evidenceHash(configuration.model),
        runtime: Bun.version, dependencyFingerprint, transport: {maxRetries: 0, timeoutMs: 45_000, maxOutputTokens: 1200, store: false},
        order: schedule.map(({label}) => label),
        commonInputHashes: pairs.map((pair) => ({caseId: pair.task.id, hash: evidenceHash(selectionInput(pair))})),
        boundary: 'One strict renderer-enum selection per case/arm; no retries, SQL, tools, generated captions or participant measures.'};
    const journal = new SelectionJournal(root, configuration);
    let budget: ProviderRequestBudget | undefined;
    const attempts: SelectionAttempt[] = [];
    try
    {
        journal.bind(manifest);
        const path = join(root, 'budget.sqlite');
        if (existsSync(path) && (lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile())) throw new Error('Invalid budget file.');
        budget = new ProviderRequestBudget(path, SELECTION_PILOT_MAXIMUM);
        const reservations = budget.reservations();
        if ((budget.summary() as {requests: number}).requests !== reservations.length
            || new Set(reservations.map(({label}) => label)).size !== reservations.length
            || reservations.some(({label}) => !schedule.some((entry) => entry.label === label))) throw new Error('Invalid pilot reservations.');
        for (const [index, {pair, arm, label}] of schedule.entries())
        {
            const slot = index + 1; const prior = reservations.find((row) => row.label === label);
            if (prior)
            {
                let result = journal.read<SelectionAttempt>(attemptName(slot, 'result'));
                if (!result)
                {
                    const record = journal.read<SelectionResponseRecord>(attemptName(slot, 'response'));
                    result = record ? responseAttempt(record, pair, arm, slot, prior.id, budget, true)
                        : {slot, reservation: prior.id, caseId: pair.task.id, arm, outcome: 'interrupted', choice: null, usage: null,
                            durationMs: null, responseId: null, responseModelFingerprint: null, outputBytes: null, responseBytes: null, recovered: false};
                    journal.write(attemptName(slot, 'result'), result);
                }
                attempts.push(result); continue;
            }
            if (signal.aborted) break;
            const reservation = budget.reserve(label);
            const result = await executeSelectionAttempt(pair, arm, slot, reservation, journal, budget, provider, signal);
            attempts.push(result); onProgress(result);
            // Stop on infrastructure/auth/transport failure, not on an honest bad selection. Never retry a failed slot.
            if (['error', 'timeout', 'cancelled'].includes(result.outcome)) break;
        }
        const report = selectionPilotReport(attempts, budget.summary(), manifest, pairs.map(({task}) => task.id));
        const name = `report-${String(attempts.length).padStart(2, '0')}-${evidenceHash(report).slice(0, 12)}.json`;
        if (!journal.read(name)) journal.write(name, report);
        return {...report, reportFile: name};
    }
    finally {budget?.close(); journal.close();}
};
