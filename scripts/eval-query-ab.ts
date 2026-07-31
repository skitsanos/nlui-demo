import {mkdir} from 'node:fs/promises';
import {dirname, join, relative, resolve} from 'node:path';
import {SEMANTIC_CATALOG_ID, SEMANTIC_CATALOG_VERSION} from '../src/data/semantic/index.ts';
import {
    adaptScenarioForArm,
    compareQueryExperiment,
    createOpenAIExecutor,
    evaluationExitCode,
    inspectEvaluationDataset,
    loadEvaluationScenarios,
    MAX_REPEAT_COUNT,
    projectBillableRuns,
    QUERY_EXPERIMENT_ARMS,
    runEvaluationSuite,
    type EvaluationReport,
    type EvaluationScenario,
    type QueryExperimentArm,
    type QueryExperimentComparison
} from '../src/evals/index.ts';
import {createConfiguredOpenAIChatRunner} from '../src/services/openaiChat.ts';

const EXPERIMENT_PATH = join(process.cwd(), 'data', 'experiments', 'semantic-query-v1.jsonl');
const RESULTS_DIRECTORY = resolve(process.cwd(), 'eval-results');

interface CliOptions
{
    ids: string[];
    cases: string[];
    all: boolean;
    repeat: number;
    timeoutMs: number;
    confirmBillable: boolean;
    json: boolean;
    output?: string;
}

const readInteger = (value: string | undefined, name: string): number =>
{
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer`);
    return parsed;
};

const parseArguments = (args: string[]): CliOptions =>
{
    const options: CliOptions = {
        ids: [], cases: [], all: false, repeat: 1, timeoutMs: 120_000,
        confirmBillable: false, json: false
    };
    for (let index = 0; index < args.length; index += 1)
    {
        const argument = args[index];
        const value = args[index + 1];
        if (argument === '--id' || argument === '--case')
        {
            if (!value) throw new Error(`${argument} requires a value`);
            (argument === '--id' ? options.ids : options.cases).push(value);
            index += 1;
        }
        else if (argument === '--all') options.all = true;
        else if (argument === '--repeat')
        {
            options.repeat = readInteger(value, '--repeat');
            index += 1;
        }
        else if (argument === '--timeout-ms')
        {
            options.timeoutMs = readInteger(value, '--timeout-ms');
            index += 1;
        }
        else if (argument === '--confirm-billable') options.confirmBillable = true;
        else if (argument === '--json') options.json = true;
        else if (argument === '--output')
        {
            if (!value) throw new Error('--output requires a value');
            options.output = resolve(process.cwd(), value);
            index += 1;
        }
        else throw new Error(`Unknown argument: ${argument}`);
    }
    const selectionModes = Number(options.all) + Number(options.ids.length > 0) + Number(options.cases.length > 0);
    if (selectionModes !== 1) throw new Error('Select exactly one of --all, one or more --id, or one or more --case.');
    if (options.repeat < 1 || options.repeat > MAX_REPEAT_COUNT)
    {
        throw new Error(`--repeat must be between 1 and ${MAX_REPEAT_COUNT}`);
    }
    if (options.timeoutMs < 1_000 || options.timeoutMs > 300_000)
    {
        throw new Error('--timeout-ms must be between 1000 and 300000');
    }
    if (options.output)
    {
        const outputRelative = relative(RESULTS_DIRECTORY, options.output);
        if (outputRelative.startsWith('..') || resolve(RESULTS_DIRECTORY, outputRelative) !== options.output
            || !options.output.endsWith('.json'))
        {
            throw new Error('--output must be a JSON file inside the ignored eval-results directory');
        }
    }
    return options;
};

const unique = (values: string[]): string[] => [...new Set(values)];

const selectExperimentScenarios = (
    catalog: EvaluationScenario[],
    options: CliOptions
): EvaluationScenario[] =>
{
    const knownIds = new Set(catalog.map(({id}) => id));
    const knownCases = new Set(catalog.map(({experiment}) => experiment?.caseId).filter(Boolean));
    const unknownIds = unique(options.ids).filter((id) => !knownIds.has(id));
    const unknownCases = unique(options.cases).filter((caseId) => !knownCases.has(caseId));
    if (unknownIds.length > 0) throw new Error(`Unknown experiment scenario identifiers: ${unknownIds.join(', ')}`);
    if (unknownCases.length > 0) throw new Error(`Unknown experiment cases: ${unknownCases.join(', ')}`);
    const ids = new Set(options.ids);
    const cases = new Set(options.cases);
    return catalog.filter((scenario) => options.all || ids.has(scenario.id) || cases.has(scenario.experiment?.caseId ?? ''));
};

const attachDatasetState = (
    report: EvaluationReport,
    initialFingerprint: string,
    finalFingerprint: string,
    finalIsBaseline: boolean
): void =>
{
    report.dataset.initialFingerprint = initialFingerprint;
    report.dataset.finalFingerprint = finalFingerprint;
    report.dataset.baselineBeforeRun = true;
    report.dataset.baselineAfterRun = finalIsBaseline;
    report.dataset.unexpectedMutation = !finalIsBaseline;
};

const runArm = async (
    scenarios: EvaluationScenario[],
    arm: QueryExperimentArm,
    options: CliOptions,
    initialFingerprint: string
): Promise<EvaluationReport> =>
{
    const report = await runEvaluationSuite({
        scenarios: scenarios.map((scenario) => adaptScenarioForArm(scenario, arm)),
        executor: createOpenAIExecutor({chatRunner: createConfiguredOpenAIChatRunner(arm)}),
        repeat: options.repeat,
        timeoutMs: options.timeoutMs
    });
    const final = inspectEvaluationDataset();
    attachDatasetState(report, initialFingerprint, final.fingerprint, final.isBaseline);
    if (!final.isBaseline) throw new Error(`${arm} arm changed the read-only evaluation dataset`);
    return report;
};

const percentage = (rate: number): string => `${(rate * 100).toFixed(1)}%`;
const average = (value: number): string => value.toFixed(1);

const printArm = (arm: QueryExperimentArm, comparison: QueryExperimentComparison): void =>
{
    const stats = comparison.arms[arm];
    console.log(
        `${arm.padEnd(8)} pass=${stats.pass.passed}/${stats.pass.total} (${percentage(stats.pass.rate)}) `
        + `denotation=${percentage(stats.denotation.rate)} ui=${percentage(stats.ui.rate)} `
        + `first-attempt=${percentage(stats.firstAttempt.rate)}`
    );
    console.log(
        `${' '.repeat(8)} latency=${average(stats.latencyMs.average)}ms `
        + `tokens=${average(stats.tokens.average)} rounds=${average(stats.rounds.average)} `
        + `rejected-attempts=${stats.rejectedAttempts.total}`
    );
    if (stats.runToRun.repeatedScenarios > 0)
    {
        console.log(
            `${' '.repeat(8)} stability pass=${percentage(stats.runToRun.passStability.rate)} `
            + `denotation=${percentage(stats.runToRun.denotationStability.rate)} `
            + `ui=${percentage(stats.runToRun.uiStability.rate)} `
            + `mean-latency-range=${average(stats.runToRun.latencyRangeMs.average)}ms `
            + `mean-token-range=${average(stats.runToRun.tokenRange.average)}`
        );
    }
};

const printSummary = (
    scenarios: EvaluationScenario[],
    reports: Record<QueryExperimentArm, EvaluationReport>,
    comparison: QueryExperimentComparison
): void =>
{
    const models = unique(QUERY_EXPERIMENT_ARMS.flatMap((arm) =>
        reports[arm].results.map(({trace}) => trace.model).filter((model): model is string => Boolean(model))
    ));
    const prompts = QUERY_EXPERIMENT_ARMS.map((arm) =>
        `${arm}:${unique(reports[arm].results.map(({trace}) => trace.promptVersion ?? 'unknown')).join(',')}`
    );
    console.log(
        `Experiment ${comparison.experimentId}: ${scenarios.length} paraphrase(s), `
        + `${comparison.repeat} repeat(s), ${comparison.pairs.length} paired run(s).`
    );
    console.log(
        `dataset=${reports.control.dataset.id}@${reports.control.dataset.version} `
        + `model=${models.join(',') || 'unknown'} catalog=${SEMANTIC_CATALOG_ID}@${SEMANTIC_CATALOG_VERSION}`
    );
    console.log(`prompts ${prompts.join(' ')}`);
    printArm('control', comparison);
    printArm('semantic', comparison);
    for (const item of comparison.cases)
    {
        const status = item.allParaphrasesPass.paired ? 'pass' : 'fail';
        const denotation = item.allParaphrasesDenotationPass.paired ? 'pass' : 'fail';
        console.log(
            `${status.padEnd(8)} case=${item.caseId} paraphrases=${item.paraphraseIds.length} `
            + `paired-denotation=${denotation}`
        );
    }
};

const reportMetadata = (reports: Record<QueryExperimentArm, EvaluationReport>) => ({
    dataset: `${reports.control.dataset.id}@${reports.control.dataset.version}`,
    models: unique(QUERY_EXPERIMENT_ARMS.flatMap((arm) =>
        reports[arm].results.map(({trace}) => trace.model).filter((model): model is string => Boolean(model))
    )),
    prompts: Object.fromEntries(QUERY_EXPERIMENT_ARMS.map((arm) => [
        arm,
        unique(reports[arm].results.map(({trace}) => trace.promptVersion ?? 'unknown'))
    ])),
    semanticCatalog: {id: SEMANTIC_CATALOG_ID, version: SEMANTIC_CATALOG_VERSION}
});

const main = async (): Promise<void> =>
{
    if (process.env.NLUI_EVAL_LIVE !== '1')
    {
        throw new Error('Live query experiment is disabled. Set NLUI_EVAL_LIVE=1 to opt in.');
    }
    const options = parseArguments(Bun.argv.slice(2));
    if (!options.confirmBillable) throw new Error('Live query experiment requires --confirm-billable.');
    const scenarios = selectExperimentScenarios(await loadEvaluationScenarios(EXPERIMENT_PATH), options);
    const projection = projectBillableRuns(scenarios, options.repeat);
    const initial = inspectEvaluationDataset();
    if (!initial.isBaseline)
    {
        throw new Error('The demo database differs from the deterministic baseline. Run bun run reset:data first.');
    }
    console.error(
        `Projected provider calls: ${projection.totalRuns} `
        + `(${projection.runsPerArm} per arm; maximum ${projection.maximumRuns}).`
    );
    const reports = {} as Record<QueryExperimentArm, EvaluationReport>;
    for (const arm of QUERY_EXPERIMENT_ARMS)
    {
        console.error(`Running ${arm} arm...`);
        reports[arm] = await runArm(scenarios, arm, options, initial.fingerprint);
    }
    const comparison = compareQueryExperiment(scenarios, reports.control, reports.semantic);
    const integrityViolation = QUERY_EXPERIMENT_ARMS.some((arm) => reports[arm].dataset.unexpectedMutation);
    const exitCode = Math.max(...QUERY_EXPERIMENT_ARMS.map((arm) =>
        evaluationExitCode(reports[arm].summary, false, integrityViolation)
    )) as 0 | 1 | 2;
    const payload = {metadata: reportMetadata(reports), projection, comparison, reports};
    if (options.output)
    {
        await mkdir(dirname(options.output), {recursive: true});
        await Bun.write(options.output, `${JSON.stringify(payload, null, 2)}\n`);
        console.error(`Wrote ignored experiment report to ${relative(process.cwd(), options.output)}.`);
    }
    if (options.json)
    {
        console.log(JSON.stringify(payload, null, 2));
    }
    else printSummary(scenarios, reports, comparison);
    process.exitCode = exitCode;
};

await main().catch((error: unknown) =>
{
    console.error(error instanceof Error ? error.message : 'Query experiment failed');
    process.exitCode = 1;
});
