export interface RateStatistic
{
    passed: number;
    total: number;
    rate: number;
}

export interface NumericStatistic
{
    total: number;
    average: number;
    observedRuns: number;
}

export interface ArmRunObservation
{
    passed: boolean;
    exactTool: boolean;
    deterministic?: boolean;
    denotation?: boolean;
    firstAttempt?: boolean;
    sqlSemantics?: boolean;
    ui: boolean;
    latencyMs: number;
    tokens?: number;
    rounds: number;
    rejectedAttempts: number;
}

export interface RunToRunStatistics
{
    repeatedScenarios: number;
    passStability: RateStatistic;
    denotationStability: RateStatistic;
    firstAttemptStability: RateStatistic;
    uiStability: RateStatistic;
    latencyRangeMs: NumericStatistic;
    tokenRange: NumericStatistic;
}

export interface ArmExperimentStatistics
{
    runs: number;
    pass: RateStatistic;
    exactTool: RateStatistic;
    deterministic: RateStatistic;
    denotation: RateStatistic;
    firstAttempt: RateStatistic;
    sqlSemantics: RateStatistic;
    ui: RateStatistic;
    latencyMs: NumericStatistic;
    tokens: NumericStatistic;
    rounds: NumericStatistic;
    rejectedAttempts: {runs: number; total: number; rate: number};
    runToRun: RunToRunStatistics;
}

interface NamedObservation
{
    scenarioId: string;
    observation: ArmRunObservation;
}

const rate = (values: Array<boolean | undefined>): RateStatistic =>
{
    const observed = values.filter((value): value is boolean => value !== undefined);
    const passed = observed.filter(Boolean).length;
    return {passed, total: observed.length, rate: observed.length === 0 ? 0 : passed / observed.length};
};

const numeric = (values: Array<number | undefined>): NumericStatistic =>
{
    const observed = values.filter((value): value is number => value !== undefined);
    const total = observed.reduce((sum, value) => sum + value, 0);
    return {total, average: observed.length === 0 ? 0 : total / observed.length, observedRuns: observed.length};
};

const repeatedGroups = (runs: NamedObservation[]): ArmRunObservation[][] =>
{
    const grouped = new Map<string, ArmRunObservation[]>();
    for (const {scenarioId, observation} of runs)
    {
        grouped.set(scenarioId, [...grouped.get(scenarioId) ?? [], observation]);
    }
    return [...grouped.values()].filter((group) => group.length > 1);
};

const stable = (
    groups: ArmRunObservation[][],
    select: (run: ArmRunObservation) => boolean | undefined
): RateStatistic => rate(groups.map((group) =>
{
    const values = group.map(select);
    if (values.some((value) => value === undefined)) return undefined;
    return values.every((value) => value === values[0]);
}));

const range = (values: Array<number | undefined>): number | undefined =>
{
    const observed = values.filter((value): value is number => value !== undefined);
    return observed.length < 2 ? undefined : Math.max(...observed) - Math.min(...observed);
};

const summarizeRunToRun = (runs: NamedObservation[]): RunToRunStatistics =>
{
    const groups = repeatedGroups(runs);
    return {
        repeatedScenarios: groups.length,
        passStability: stable(groups, ({passed}) => passed),
        denotationStability: stable(groups, ({denotation}) => denotation),
        firstAttemptStability: stable(groups, ({firstAttempt}) => firstAttempt),
        uiStability: stable(groups, ({ui}) => ui),
        latencyRangeMs: numeric(groups.map((group) => range(group.map(({latencyMs}) => latencyMs)))),
        tokenRange: numeric(groups.map((group) => range(group.map(({tokens}) => tokens))))
    };
};

export const summarizeArmRuns = (namedRuns: NamedObservation[]): ArmExperimentStatistics =>
{
    const runs = namedRuns.map(({observation}) => observation);
    const rejectedRuns = runs.filter(({rejectedAttempts}) => rejectedAttempts > 0).length;
    return {
        runs: runs.length,
        pass: rate(runs.map(({passed}) => passed)),
        exactTool: rate(runs.map(({exactTool}) => exactTool)),
        deterministic: rate(runs.map(({deterministic}) => deterministic)),
        denotation: rate(runs.map(({denotation}) => denotation)),
        firstAttempt: rate(runs.map(({firstAttempt}) => firstAttempt)),
        sqlSemantics: rate(runs.map(({sqlSemantics}) => sqlSemantics)),
        ui: rate(runs.map(({ui}) => ui)),
        latencyMs: numeric(runs.map(({latencyMs}) => latencyMs)),
        tokens: numeric(runs.map(({tokens}) => tokens)),
        rounds: numeric(runs.map(({rounds}) => rounds)),
        rejectedAttempts: {
            runs: rejectedRuns,
            total: runs.reduce((sum, {rejectedAttempts}) => sum + rejectedAttempts, 0),
            rate: runs.length === 0 ? 0 : rejectedRuns / runs.length
        },
        runToRun: summarizeRunToRun(namedRuns)
    };
};
