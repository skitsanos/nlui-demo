import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import manifest from '../data/fixture-manifest.json';
import {createDemoRepository, resetDemoDatabase} from '../src/data/index.ts';
import {semanticCatalogMetadata} from '../src/data/semantic/metadata.ts';
import {redactConfiguredValues} from '../src/evals/reportRedaction.ts';
import type {NluiBlock} from '../src/nlui/types.ts';
import {ProviderRequestBudget} from '../src/research/budget.ts';
import {runControlSurface} from '../src/research/controlSurfaceRun.ts';
import {RESEARCH_QUERY_ARMS, RESEARCH_QUERY_CASES} from '../src/research/queryCases.ts';
import {runResearchQuery} from '../src/research/queryRun.ts';
import {runResearchSurface} from '../src/research/surfaceRun.ts';

const args = new Set(process.argv.slice(2));
for (const arg of args) if (!['--confirm-billable', '--queries', '--surfaces', '--surface-control'].includes(arg)) throw new Error('Unsupported research argument.');
if (!args.has('--queries') && !args.has('--surfaces') && !args.has('--surface-control')) throw new Error('Choose --queries, --surfaces or --surface-control.');
if (!args.has('--confirm-billable'))
{
    console.log(JSON.stringify({billable: false, approvedMaximumRequests: 40, queryTurns: args.has('--queries') ? 16 : 0,
        surfaceRequests: (args.has('--surfaces') ? 4 : 0) + (args.has('--surface-control') ? 1 : 0), notice: 'Re-run with --confirm-billable only after approval. Tool repairs consume the same hard budget.'}));
    process.exit(0);
}
const budget = new ProviderRequestBudget(resolve('eval-results/remaining-2026-10-15-budget.sqlite'), 40);
const root = mkdtempSync(join(tmpdir(), 'nlui-research-v3-'));
const databasePath = join(root, 'demo.sqlite');
resetDemoDatabase({databasePath});
const repository = createDemoRepository({databasePath});
const results: unknown[] = [];
const path = resolve(`eval-results/remaining-${args.has('--queries') ? 'queries' : 'surfaces'}-2026-10-15-${Date.now()}.json`);
try
{
    if (args.has('--queries'))
    {
        // Paired order alternates per paraphrase; no unsafe actions or candidate promotion.
        for (const [index, item] of RESEARCH_QUERY_CASES.entries()) for (const arm of index % 2 ? [...RESEARCH_QUERY_ARMS].reverse() : RESEARCH_QUERY_ARMS)
        {
            const result = await runResearchQuery(item, arm, {databasePath, repository}, budget);
            results.push(result);
            console.log(JSON.stringify({case: item.id, arm, pass: result.pass, requests: result.requests, denotation: result.denotation}));
        }
    }
    if (args.has('--surfaces'))
    {
        const samples: NluiBlock[][] = [
            [{id: 'metric-one', type: 'stats', title: 'Revenue', items: [{label: 'Revenue', value: 100, format: 'currency'}]}],
            [{id: 'chart-one', type: 'chart', title: 'Trend', variant: 'line', categoryKey: 'month', valueKey: 'value', data: [{month: 'June', value: 100}]}],
            [{id: 'table-one', type: 'table', title: 'Orders', columns: [{key: 'id', label: 'Order'}], rows: [{id: 'ORD-1'}], rowKey: 'id'}],
            [{id: 'form-one', type: 'form', title: 'Choose a preference', interactionId: 'issued-form', fields: [{name: 'preference', input: 'text', label: 'Preference'}], submitLabel: 'Continue'},
                {id: 'choice-one', type: 'choices', interactionId: 'issued-choice', options: [{value: 'one', label: 'Option one'}]},
                {id: 'notice-one', type: 'result', status: 'info', message: 'Review before continuing.'}]
        ];
        for (const [index, sample] of samples.entries())
        {
            const result = await runResearchSurface(sample, `surface-${index + 1}`, budget);
            results.push(result); console.log(JSON.stringify({case: result.id, pass: result.pass}));
        }
    }
    if (args.has('--surface-control'))
    {
        results.push(await runControlSurface([
            {id: 'form-one', type: 'form', title: 'Choose a preference', interactionId: 'issued-form', fields: [{name: 'preference', input: 'text', label: 'Preference'}], submitLabel: 'Continue'},
            {id: 'choice-one', type: 'choices', interactionId: 'issued-choice', options: [{value: 'one', label: 'Option one'}]},
            {id: 'notice-one', type: 'result', status: 'info', message: 'Review before continuing.'}
        ], budget));
    }
}
finally
{
    const report = {date: '2026-10-15', dataset: manifest.datasetId, fixtureFingerprint: manifest.baselineFingerprint,
        catalogVersion: semanticCatalogMetadata().version, maximumProviderRequests: 40, accounting: budget.summary(),
        monetaryCost: {status: 'unpriced', reason: 'No matching versioned pricing input; token usage is reported, not assumed free.'},
        promotion: {promoted: false, reason: 'A bounded pilot is not statistically sufficient to replace guarded SQL or the controlled renderer.'}, results};
    await Bun.write(path, JSON.stringify(redactConfiguredValues(report), null, 2));
    console.log(JSON.stringify({report: path, accounting: budget.summary()}));
    repository.close(); budget.close(); rmSync(root, {recursive: true, force: true});
}
