import {datasetQueryHasWhereEquality} from '../data/queryPolicy.ts';
import type {ChatToolTrace} from '../services/chatTrace.ts';
import {observedBlockNames} from './blockNames.ts';
import type {DeterministicAssertion, EvaluationScenario} from './scenario.ts';
import {evaluateSqlSemantics} from './sqlSemantics.ts';
import type {DataAssertionResult, EvaluationTrace} from './types.ts';

type DenotationAssertion = Extract<DeterministicAssertion, {source: 'denotation'}>;

const valueAtPath = (source: unknown, path: string): unknown =>
{
    let current = source;
    for (const part of path.split('.'))
    {
        if (typeof current !== 'object' || current === null || !Object.hasOwn(current, part)) return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return current;
};

const successfulExecution = (trace: EvaluationTrace, tool: string): ChatToolTrace | undefined =>
    trace.toolExecutions?.findLast((execution) => execution.name === tool && !execution.rejected);

const normalizedToolOutput = (source: unknown): unknown =>
{
    if (typeof source !== 'object' || source === null) return source;
    const result = source as Record<string, unknown>;
    if (!Array.isArray(result.columns) || !Array.isArray(result.rows)) return source;
    const rows = result.rows;
    const columns = result.columns.filter((column): column is Record<string, unknown> =>
        typeof column === 'object' && column !== null
        && typeof (column as Record<string, unknown>).key === 'string'
        && typeof (column as Record<string, unknown>).name === 'string'
    );
    const visible = Array.isArray(result.presentationColumnKeys)
        ? new Set(result.presentationColumnKeys.filter((key): key is string => typeof key === 'string'))
        : undefined;
    const selected = visible ? columns.filter(({key}) => visible.has(String(key))) : columns;
    const records = rows.map((row) =>
        typeof row === 'object' && row !== null ? row as Record<string, unknown> : undefined
    );
    return {
        ...result,
        rows: records.map((row, index) => row
            ? Object.fromEntries(selected.map(({key, name}) => [String(name), row[String(key)]]))
            : rows[index]),
        denotationTuples: records.map((row) =>
            row ? selected.map(({key}) => row[String(key)]) : []
        )
    };
};

const numericMatch = (
    observed: number,
    expected: number,
    tolerance?: DenotationAssertion['tolerance']
): boolean =>
{
    if (!tolerance) return observed === expected;
    const difference = Math.abs(observed - expected);
    const absolute = tolerance.absolute ?? 0;
    const relative = (tolerance.relative ?? 0) * Math.abs(expected);
    return difference <= Math.max(absolute, relative);
};

const unorderedArrayMatch = (
    observed: unknown[],
    expected: unknown[],
    matches: (left: unknown, right: unknown) => boolean
): boolean =>
{
    if (observed.length !== expected.length) return false;
    const assigned = Array<number>(observed.length).fill(-1);
    const assign = (expectedIndex: number, seen: Set<number>): boolean =>
    {
        for (const [observedIndex, value] of observed.entries())
        {
            if (seen.has(observedIndex) || !matches(value, expected[expectedIndex])) continue;
            seen.add(observedIndex);
            if (assigned[observedIndex] === -1 || assign(assigned[observedIndex]!, seen))
            {
                assigned[observedIndex] = expectedIndex;
                return true;
            }
        }
        return false;
    };
    return expected.every((_value, index) => assign(index, new Set()));
};

const denotationMatches = (
    observed: unknown,
    expected: unknown,
    assertion: DenotationAssertion,
    root = true
): boolean =>
{
    if (typeof observed === 'number' && typeof expected === 'number')
    {
        return numericMatch(observed, expected, assertion.tolerance);
    }
    if (Array.isArray(observed) || Array.isArray(expected))
    {
        if (!Array.isArray(observed) || !Array.isArray(expected)) return false;
        const matches = (left: unknown, right: unknown) => denotationMatches(left, right, assertion, false);
        if (root && assertion.arrayOrder === 'unordered') return unorderedArrayMatch(observed, expected, matches);
        return observed.length === expected.length && observed.every((value, index) => matches(value, expected[index]));
    }
    if (typeof observed === 'object' || typeof expected === 'object')
    {
        if (observed === null || expected === null || typeof observed !== 'object' || typeof expected !== 'object')
        {
            return observed === expected;
        }
        const observedRecord = observed as Record<string, unknown>;
        const expectedRecord = expected as Record<string, unknown>;
        const observedKeys = Object.keys(observedRecord).toSorted();
        const expectedKeys = Object.keys(expectedRecord).toSorted();
        return observedKeys.length === expectedKeys.length
            && observedKeys.every((key, index) => key === expectedKeys[index]
                && denotationMatches(observedRecord[key], expectedRecord[key], assertion, false));
    }
    return observed === expected;
};

const toolAssertionPassed = (
    assertion: Extract<DeterministicAssertion, {source: 'tool'}>,
    observed: unknown
): boolean =>
{
    if (assertion.operator === 'equals') return observed === assertion.expected;
    if (assertion.operator === 'length_equals')
    {
        return (Array.isArray(observed) || typeof observed === 'string') && observed.length === assertion.expected;
    }
    if (assertion.operator === 'contains_value')
    {
        return (Array.isArray(observed) && observed.includes(assertion.expected))
            || (typeof observed === 'object' && observed !== null
                && Object.values(observed).includes(assertion.expected));
    }
    return (Array.isArray(observed) && observed.includes(assertion.expected))
        || (typeof observed === 'string' && typeof assertion.expected === 'string'
            && observed.includes(assertion.expected));
};

const exactNumberInText = (text: string, expected: number): boolean =>
{
    const escaped = String(expected).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\d.,])${escaped}(?![\\d.,])`).test(text);
};

const toolSequenceFailure = (
    assertion: Extract<DeterministicAssertion, {source: 'tool_sequence'}>,
    trace: EvaluationTrace
): string | undefined =>
{
    const attempts = trace.toolExecutions?.filter(({name, cached}) => name === assertion.tool && !cached) ?? [];
    const successfulAttempt = attempts.findIndex(({rejected}) => !rejected) + 1;
    return successfulAttempt === assertion.expected
        ? undefined
        : `Expected ${assertion.tool} success on attempt ${assertion.expected}, observed ${successfulAttempt || 'no success'}`;
};

const evaluateRule = (rule: DeterministicAssertion, trace: EvaluationTrace): string | undefined =>
{
    if (rule.source === 'assistant_text')
    {
        const includesExpected = typeof rule.expected === 'string'
            && trace.text.toLowerCase().includes(rule.expected.toLowerCase());
        const passed = rule.operator === 'contains_ci' ? includesExpected
            : rule.operator === 'not_contains_ci' ? !includesExpected
                : typeof rule.expected === 'number' && exactNumberInText(trace.text, rule.expected);
        return passed ? undefined : `Assistant text did not satisfy ${rule.operator} ${JSON.stringify(rule.expected)}`;
    }
    if (rule.source === 'ui')
    {
        const observed = observedBlockNames(trace).toSorted();
        const expected = rule.expected.toSorted();
        const passed = observed.length === expected.length
            && observed.every((block, index) => block === expected[index]);
        return passed ? undefined : `Expected UI block types ${JSON.stringify(expected)}, observed ${JSON.stringify(observed)}`;
    }
    if (rule.source === 'tool_sequence') return toolSequenceFailure(rule, trace);

    const execution = successfulExecution(trace, rule.tool);
    if (!execution) return `No successful ${rule.tool} execution was captured`;
    if (rule.source === 'tool_arguments')
    {
        const sql = valueAtPath(execution.arguments, 'sql');
        const passed = typeof sql === 'string'
            && datasetQueryHasWhereEquality(sql, rule.expected.column, rule.expected.value);
        return passed ? undefined : `Expected SQL WHERE ${rule.expected.column} = ${JSON.stringify(rule.expected.value)}`;
    }
    if (rule.source === 'sql_semantics')
    {
        const sql = valueAtPath(execution.arguments, 'sql');
        return typeof sql === 'string' ? evaluateSqlSemantics(rule, sql) : 'No SQL argument was captured';
    }
    if (rule.source === 'denotation')
    {
        const observed = valueAtPath(normalizedToolOutput(execution.modelOutput), rule.path);
        return denotationMatches(observed, rule.expected, rule)
            ? undefined
            : `Denotation at ${rule.path} did not satisfy ${rule.operator}`;
    }
    const observed = valueAtPath(execution.modelOutput, rule.path);
    return toolAssertionPassed(rule, observed)
        ? undefined
        : `Expected ${rule.path} ${rule.operator} ${JSON.stringify(rule.expected)}`;
};

export const evaluateDeterministicAssertions = (
    scenario: EvaluationScenario,
    trace: EvaluationTrace
): DataAssertionResult[] =>
{
    const configured = new Map<string, DeterministicAssertion[]>();
    for (const rule of scenario.deterministicAssertions ?? [])
    {
        configured.set(rule.label, [...configured.get(rule.label) ?? [], rule]);
    }
    return scenario.dataAssertions.map((assertion) =>
    {
        const rules = configured.get(assertion);
        if (!rules) return {assertion, status: 'not_evaluated', detail: 'No deterministic assertion is configured'};
        const failures = rules.map((rule) => evaluateRule(rule, trace)).filter((detail) => detail !== undefined);
        return {
            assertion,
            status: failures.length === 0 ? 'passed' : 'failed',
            ...failures.length > 0 && {detail: failures.join('; ')}
        };
    });
};
