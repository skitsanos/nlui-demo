import {runPresentationBenchmark} from '../src/evals/presentation/benchmark.ts';

const {report} = await runPresentationBenchmark();
console.log(JSON.stringify(report, null, 2));
if (!report.dataset.unchanged || report.results.some(({baseline, candidate}) => !baseline.passed || !candidate.passed)
    || report.canaries.some(({passed}) => passed) || report.negativeControls.some(({errors}) => !errors.includes('ineligible_representation'))) process.exitCode = 1;
