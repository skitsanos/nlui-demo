import {createReferenceExecutor} from '../src/evals/referenceExecutor.ts';
import {redactConfiguredValues} from '../src/evals/reportRedaction.ts';
import {runEvaluationSuite} from '../src/evals/run.ts';
import {loadEvaluationScenarios} from '../src/evals/scenario.ts';

const catalog = await loadEvaluationScenarios();
const executor = createReferenceExecutor(catalog);
const reports = [];
for (let start = 0; start < catalog.length; start += 10)
{
    reports.push(await runEvaluationSuite({scenarios: catalog.slice(start, start + 10), executor, timeoutMs: 15_000}));
}
if (Bun.argv.includes('--json')) console.log(JSON.stringify(redactConfiguredValues({kind: 'provider-free-reference', reports}), null, 2));
else for (const report of reports) for (const result of report.results)
{
    console.log(`${result.status.padEnd(10)} ${result.scenarioId}`);
    for (const assertion of result.dataAssertions.filter(({status}) => status !== 'passed'))
    {
        console.log(`  ${assertion.status}: ${assertion.assertion}: ${assertion.detail}`);
    }
}
process.exitCode = reports.some(({summary}) => summary.failed || summary.errors) ? 1 : 0;
