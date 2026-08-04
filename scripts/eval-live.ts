import {
    createOpenAIExecutor,
    EVALUATION_CATEGORIES,
    evaluationExitCode,
    executionFor,
    inspectEvaluationDataset,
    loadEvaluationScenarios,
    MAX_LIVE_SCENARIOS,
    MAX_REPEAT_COUNT,
    redactConfiguredText,
    redactConfiguredValues,
    runEvaluationSuite,
    selectScenarios,
    type EvaluationCategory
} from '../src/evals/index.ts';

interface CliOptions
{
    ids: string[];
    categories: EvaluationCategory[];
    limit?: number;
    repeat: number;
    timeoutMs: number;
    allowSafeActions: boolean;
    allowIncomplete: boolean;
    confirmBillable: boolean;
    json: boolean;
}

const readInteger = (value: string | undefined, name: string): number =>
{
    const parsed = Number(value);
    if (!Number.isInteger(parsed))
    {
        throw new Error(`${name} must be an integer`);
    }
    return parsed;
};

const parseArguments = (args: string[]): CliOptions =>
{
    const options: CliOptions = {
        ids: [],
        categories: [],
        repeat: 1,
        timeoutMs: 120_000,
        allowSafeActions: false,
        allowIncomplete: false,
        confirmBillable: false,
        json: false
    };

    for (let index = 0; index < args.length; index += 1)
    {
        const argument = args[index];
        const value = args[index + 1];
        if (argument === '--id')
        {
            if (!value) throw new Error('--id requires a value');
            options.ids.push(value);
            index += 1;
        }
        else if (argument === '--category')
        {
            if (!value || !EVALUATION_CATEGORIES.includes(value as EvaluationCategory))
            {
                throw new Error(`--category must be one of: ${EVALUATION_CATEGORIES.join(', ')}`);
            }
            options.categories.push(value as EvaluationCategory);
            index += 1;
        }
        else if (argument === '--limit')
        {
            options.limit = readInteger(value, '--limit');
            index += 1;
        }
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
        else if (argument === '--allow-safe-actions')
        {
            options.allowSafeActions = true;
        }
        else if (argument === '--allow-incomplete')
        {
            options.allowIncomplete = true;
        }
        else if (argument === '--confirm-billable')
        {
            options.confirmBillable = true;
        }
        else if (argument === '--json')
        {
            options.json = true;
        }
        else
        {
            throw new Error(`Unknown argument: ${argument}`);
        }
    }

    if (options.repeat < 1 || options.repeat > MAX_REPEAT_COUNT)
    {
        throw new Error(`--repeat must be between 1 and ${MAX_REPEAT_COUNT}`);
    }
    if (options.limit !== undefined && (options.limit < 1 || options.limit > MAX_LIVE_SCENARIOS))
    {
        throw new Error(`--limit must be between 1 and ${MAX_LIVE_SCENARIOS}`);
    }
    if (options.timeoutMs < 1_000 || options.timeoutMs > 300_000)
    {
        throw new Error('--timeout-ms must be between 1000 and 300000');
    }
    return options;
};

const main = async (): Promise<void> =>
{
    if (process.env.NLUI_EVAL_LIVE !== '1')
    {
        throw new Error('Live evaluation is disabled. Set NLUI_EVAL_LIVE=1 to opt in.');
    }

    const options = parseArguments(Bun.argv.slice(2));
    if (!options.confirmBillable)
    {
        throw new Error('Live evaluation requires --confirm-billable.');
    }
    const selectionLimit = options.limit ?? (options.ids.length > 0 ? options.ids.length : 1);
    const scenarios = selectScenarios(await loadEvaluationScenarios(), {
        ids: options.ids,
        categories: options.categories,
        limit: selectionLimit
    });
    const unsupported = scenarios.filter((scenario) => executionFor(scenario).mode !== 'single-turn');
    if (unsupported.length > 0)
    {
        throw new Error(
            `Live OpenAI runner supports single-turn scenarios only: ${unsupported.map(({id}) => id).join(', ')}`
        );
    }
    const includesSafeActions = scenarios.some(({category}) => category === 'safe-action');
    if (!options.allowSafeActions && includesSafeActions)
    {
        throw new Error('Safe-action scenarios require --allow-safe-actions and a reset demo database');
    }
    if (includesSafeActions && options.repeat > 1)
    {
        throw new Error('Safe-action scenarios require --repeat 1 until isolated mutation runners are available');
    }

    const datasetState = inspectEvaluationDataset();
    if (!datasetState.isBaseline)
    {
        throw new Error('The demo database differs from the deterministic baseline. Run bun run reset:data first.');
    }

    const report = await runEvaluationSuite({
        scenarios,
        executor: createOpenAIExecutor(),
        repeat: options.repeat,
        timeoutMs: options.timeoutMs
    });
    const finalDatasetState = inspectEvaluationDataset();
    report.dataset.initialFingerprint = datasetState.fingerprint;
    report.dataset.finalFingerprint = finalDatasetState.fingerprint;
    report.dataset.baselineBeforeRun = true;
    report.dataset.baselineAfterRun = finalDatasetState.isBaseline;
    const unexpectedMutation = !includesSafeActions && !finalDatasetState.isBaseline;
    report.dataset.unexpectedMutation = unexpectedMutation;
    const exitCode = evaluationExitCode(report.summary, options.allowIncomplete, unexpectedMutation);

    if (options.json)
    {
        console.log(JSON.stringify(redactConfiguredValues(report), null, 2));
        process.exitCode = exitCode;
        return;
    }

    console.log(`Evaluated ${report.summary.total} run(s) across ${report.selection.scenarioIds.length} scenario(s).`);
    for (const result of report.results)
    {
        console.log(`${result.status.padEnd(10)} ${result.scenarioId} ${result.latency.totalMs.toFixed(0)}ms`);
        if (result.status === 'failed' || result.status === 'error')
        {
            for (const detail of [
                ...result.checks.filter(({status}) => status === 'failed').map(({name, detail}) => `${name}: ${detail}`),
                ...result.dataAssertions
                    .filter(({status}) => status === 'failed')
                    .map(({assertion, detail}) => `${assertion}: ${detail}`),
                ...result.error ? [result.error] : []
            ])
            {
                console.log(`  ${redactConfiguredText(detail)}`);
            }
        }
        else if (result.status === 'incomplete')
        {
            for (const {assertion} of result.dataAssertions.filter(({status}) => status === 'not_evaluated'))
            {
                console.log(`  ungraded: ${assertion}`);
            }
        }
    }
    console.log(
        `passed=${report.summary.passed} failed=${report.summary.failed} ` +
        `incomplete=${report.summary.incomplete} errors=${report.summary.errors}`
    );
    if (unexpectedMutation)
    {
        console.log('dataset_integrity=failed (a read-only evaluation changed the demo database)');
    }
    if (report.summary.usage)
    {
        console.log(
            `tokens input=${report.summary.usage.inputTokens ?? 0} `
            + `output=${report.summary.usage.outputTokens ?? 0} total=${report.summary.usage.totalTokens ?? 0}`
        );
    }
    process.exitCode = exitCode;
};

await main().catch((error: unknown) =>
{
    console.error(redactConfiguredText(error instanceof Error ? error.message : 'Live evaluation failed'));
    process.exitCode = 1;
});
