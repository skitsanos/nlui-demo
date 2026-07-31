import {loadEvaluationScenarios, validateScenarioCatalog} from '../src/evals/index.ts';

const report = validateScenarioCatalog(await loadEvaluationScenarios());
const json = Bun.argv.includes('--json');

if (json)
{
    console.log(JSON.stringify(report, null, 2));
}
else
{
    const modes = Object.entries(report.executionModes)
        .map(([mode, count]) => `${mode}=${count}`)
        .join(' ');
    console.log(`Validated ${report.scenarios} scenarios against ${report.dataset.id} v${report.dataset.version}.`);
    console.log(modes);
    console.log(
        `deterministic_assertions=${report.deterministicAssertions} `
        + `deterministic_rules=${report.deterministicRules} `
        + `ungraded_assertions=${report.ungradedAssertions} issues=${report.issues.length}`
    );
    for (const issue of report.issues)
    {
        console.log(`ERROR ${issue.scenarioId}: ${issue.message}`);
    }
}

if (report.issues.length > 0)
{
    process.exitCode = 1;
}
