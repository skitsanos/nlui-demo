import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {applyPlanDelta, executeAnalysis, inputPlan, receiptMatchesPlan} from '../src/analysis/artifacts.ts';
import {ConversationStore} from '../src/conversations/store.ts';
import {resetDemoDatabase} from '../src/data/index.ts';
import {RESEARCH_QUERY_CASES} from '../src/research/queryCases.ts';

// Machine/backend protocol benchmark only. No provider, participant timing, or
// claim that a user makes fewer clicks/reformulations than a chat-only workflow.
const root = mkdtempSync(join(tmpdir(), 'nlui-refinement-benchmark-')); const databasePath = join(root, 'demo.sqlite');
resetDemoDatabase({databasePath}); const store = new ConversationStore(join(root, 'state.sqlite'));
const results: Array<Record<string, unknown>> = [];
try
{
    for (const item of RESEARCH_QUERY_CASES)
    {
        const base = await executeAnalysis({store, databasePath, conversation: item.id, plan: {metric: item.plan.metric}});
        const samples: number[] = []; let receipts = true; let detected = 0;
        for (let repeat = 0; repeat < 5; repeat++)
        {
            const start = performance.now();
            const plan = applyPlanDelta(base.artifact.plan, {dimensions: item.plan.dimensions, timeRange: item.plan.timeRange});
            const refined = await executeAnalysis({store, databasePath, conversation: item.id, plan: inputPlan(plan), parentResultId: base.artifact.receipt.resultId});
            samples.push(performance.now() - start); receipts &&= receiptMatchesPlan(plan, refined.artifact.receipt);
            if (!receiptMatchesPlan(plan, {...refined.artifact.receipt, filters: [{dimension: 'region', values: ['West']}]})) detected++;
        }
        results.push({id: item.id, samples: 5, backendMs: samples, averageBackendMs: samples.reduce((a, b) => a + b, 0) / samples.length,
            typedSubmissionsPerRefinement: 1, modelTurns: 0, providerRequests: 0, correctionRequests: 0,
            exactReceiptChecksPassed: receipts, mismatchedFilterCanariesDetected: detected, mismatchCanaries: 5,
            fullQuestionCharactersForChatControl: item.prompt.length});
    }
    const report = {version: 1, mode: 'provider-free-machine-protocol-benchmark', results,
        limitations: ['Not a human completion-time or reformulation study.', 'Backend timings exclude input selection and browser/network time.',
            'Live chat-control timings are recorded separately; no causal human productivity or statistically powered reliability gain is claimed.']};
    await Bun.write(resolve('eval-results/refinements-2026-10-15.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({cases: results.length, providerRequests: 0, receiptsPassed: results.every((row) => row.exactReceiptChecksPassed),
        mismatchCanariesDetected: results.reduce((count, row) => count + Number(row.mismatchedFilterCanariesDetected), 0)}));
}
finally {store.close(); rmSync(root, {recursive: true, force: true});}
