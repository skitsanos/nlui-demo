import {existsSync, lstatSync, mkdirSync, readFileSync, realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {runPresentationBenchmark} from '../src/evals/presentation/benchmark.ts';
import {SELECTION_PILOT_ID, SELECTION_PILOT_MAXIMUM} from '../src/evals/presentation/liveProtocol.ts';
import {selectionProvider} from '../src/evals/presentation/liveProvider.ts';
import {runSelectionPilot} from '../src/evals/presentation/liveRun.ts';
import {evidenceHash} from '../src/evals/presentation/oracle.ts';

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--confirm-billable')) throw new Error('Unsupported pilot option.');
if (process.env.NLUI_PRESENTATION_LIVE !== '1' || !args.includes('--confirm-billable'))
{
    console.log(JSON.stringify({billable: false, approvedMaximum: SELECTION_PILOT_MAXIMUM, plannedPairs: 16,
        notice: 'Explicit approval plus NLUI_PRESENTATION_LIVE=1 and --confirm-billable are required. One fixed ledger; no retries.'}));
    process.exit(0);
}
const apiKey = process.env.OPENAI_API_KEY?.trim(); const model = process.env.CHAT_MODEL?.trim();
if (!apiKey || !model) throw new Error('Existing ignored provider configuration is required.');
const parent = resolve(realpathSync(process.cwd()), 'eval-results');
if (existsSync(parent) && lstatSync(parent).isSymbolicLink()) throw new Error('Pilot output parent cannot be a symlink.');
mkdirSync(parent, {recursive: true, mode: 0o700});
const controller = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => controller.abort());
try
{
    const benchmark = await runPresentationBenchmark();
    const report = await runSelectionPilot({benchmark, root: resolve(parent, SELECTION_PILOT_ID), configuration: {apiKey, model},
        provider: selectionProvider(apiKey, model), signal: controller.signal, evidenceKind: 'live_provider',
        dependencyFingerprint: evidenceHash(readFileSync(resolve('bun.lock'), 'utf8')),
        onProgress: ({slot, caseId, arm, outcome, choice, usage}) => console.log(JSON.stringify({slot, caseId, arm, outcome,
            choice: choice?.representation, passed: choice?.passed ?? false, usageKnown: !!usage}))});
    console.log(JSON.stringify({complete: report.complete, accounting: report.accounting, arms: report.arms, paired: report.paired,
        report: `eval-results/${SELECTION_PILOT_ID}/${report.reportFile}`}));
    if (!report.complete || report.arms.baseline.passed !== 16 || report.arms.candidate.passed !== 16) process.exitCode = 1;
}
catch {console.error('Pilot stopped. Preserve the fixed ledger and immutable attempt files; no automatic retries or budget reset.'); process.exitCode = 1;}
