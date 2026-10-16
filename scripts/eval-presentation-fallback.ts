import {evaluateFallbackContract} from '../src/evals/presentation/fallbackEvaluation.ts';

const report = await evaluateFallbackContract();
console.log(JSON.stringify(report, null, 2));
if (!report.dataset.unchanged || report.cases.some(({arms}) => arms.some(({referenceGrades}) => referenceGrades.some(({passed}) => !passed))))
    process.exitCode = 1;
