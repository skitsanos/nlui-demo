import {Parser} from 'node-sql-parser/umd/sqlite.umd';
import {canonicalizeDatasetQuery} from '../data/queryPolicy.ts';
import type {DeterministicAssertion} from './assertionSchema.ts';

type AstNode = Record<string, any>;
type SqlAssertion = Extract<DeterministicAssertion, {source: 'sql_semantics'}>;

const parser = new Parser();
const lower = (value: unknown): string => String(value ?? '').toLowerCase();
const isNode = (value: unknown): value is AstNode => typeof value === 'object' && value !== null;

const walk = (value: unknown, visit: (node: AstNode) => void): void =>
{
    if (Array.isArray(value))
    {
        for (const item of value) walk(item, visit);
        return;
    }
    if (!isNode(value)) return;
    visit(value);
    for (const child of Object.values(value)) walk(child, visit);
};

const parsedSelects = (sql: string): AstNode[] =>
{
    const canonical = canonicalizeDatasetQuery(sql);
    const ast = parser.astify(canonical, {database: 'sqlite'});
    const selects: AstNode[] = [];
    walk(ast, (node) =>
    {
        if (node.type === 'select') selects.push(node);
    });
    return selects;
};

const aliasesFor = (select: AstNode): Map<string, string> =>
{
    const aliases = new Map<string, string>();
    for (const source of select.from ?? [])
    {
        const table = lower(source.table);
        if (!table) continue;
        aliases.set(table, table);
        if (source.as) aliases.set(lower(source.as), table);
    }
    return aliases;
};

const resolvedColumn = (node: AstNode, aliases: Map<string, string>): string | undefined =>
{
    const quotedIdentifier = node.type === 'double_quote_string' && typeof node.value === 'string'
        ? lower(node.value)
        : undefined;
    if (!quotedIdentifier && (node.type !== 'column_ref' || typeof node.column !== 'string')) return undefined;
    const column = quotedIdentifier ?? lower(node.column);
    const table = lower(node.table);
    if (table) return `${aliases.get(table) ?? table}.${column}`;
    const tables = new Set(aliases.values());
    return tables.size === 1 ? `${[...tables][0]}.${column}` : column;
};

const identifierMatches = (actual: string, expected: string): boolean =>
    expected.includes('.') ? actual === expected : actual.split('.').at(-1) === expected;

const expressionHasColumn = (value: unknown, expected: string, aliases: Map<string, string>): boolean =>
{
    let found = false;
    walk(value, (node) =>
    {
        const column = resolvedColumn(node, aliases);
        if (column && identifierMatches(column, expected)) found = true;
    });
    return found;
};

const hasJoin = (select: AstNode, left: string, right: string): boolean =>
{
    const aliases = aliasesFor(select);
    let found = false;
    for (const source of select.from ?? [])
    {
        walk(source.on, (node) =>
        {
            if (node.type !== 'binary_expr' || node.operator !== '=') return;
            const observedLeft = resolvedColumn(node.left, aliases);
            const observedRight = resolvedColumn(node.right, aliases);
            if (!observedLeft || !observedRight) return;
            found ||= (identifierMatches(observedLeft, left) && identifierMatches(observedRight, right))
                || (identifierMatches(observedLeft, right) && identifierMatches(observedRight, left));
        });
    }
    return found;
};

const usesTimeField = (
    select: AstNode,
    expected: Extract<SqlAssertion, {operator: 'uses_time_field'}>['expected']
): boolean =>
{
    const aliases = aliasesFor(select);
    if (expected.clause === 'filter') return expressionHasColumn(select.where, expected.column, aliases);
    if (expected.clause === 'group')
    {
        if (expressionHasColumn(select.groupby, expected.column, aliases)) return true;
        const groupedAliases = new Set<string>();
        walk(select.groupby, (node) =>
        {
            if (node.type === 'column_ref' && !node.table) groupedAliases.add(lower(node.column));
            else if (node.type === 'double_quote_string') groupedAliases.add(lower(node.value));
        });
        return (select.columns ?? []).some((projection: AstNode) =>
            groupedAliases.has(lower(projection.as))
            && expressionHasColumn(projection.expr, expected.column, aliases)
        );
    }
    return [select.columns, select.where, select.groupby, select.having, select.orderby]
        .some((part) => expressionHasColumn(part, expected.column, aliases));
};

const groupsBy = (select: AstNode, expected: string[]): boolean =>
{
    const aliases = aliasesFor(select);
    const columns: string[] = [];
    walk(select.groupby, (node) =>
    {
        const column = resolvedColumn(node, aliases);
        if (column) columns.push(column);
    });
    return expected.every((item) => columns.some((column) => identifierMatches(column, item)));
};

const hasDivisor = (value: unknown, divisor: number): boolean =>
{
    let found = false;
    walk(value, (node) =>
    {
        if (node.type === 'binary_expr' && node.operator === '/'
            && node.right?.type === 'number' && Number(node.right.value) === divisor)
        {
            found = true;
        }
    });
    return found;
};

const projectsUnit = (
    select: AstNode,
    expected: Extract<SqlAssertion, {operator: 'projects_unit'}>['expected']
): boolean =>
{
    const aliases = aliasesFor(select);
    return (select.columns ?? []).some((projection: AstNode) =>
        (expected.outputAlias === undefined || lower(projection.as) === expected.outputAlias)
        && expressionHasColumn(projection.expr, expected.sourceColumn, aliases)
        && (expected.divisor === undefined || hasDivisor(projection.expr, expected.divisor))
    );
};

const stringValues = (value: unknown): string[] =>
{
    const values: string[] = [];
    walk(value, (node) =>
    {
        if (node.type === 'single_quote_string') values.push(String(node.value));
    });
    return values;
};

const excludedValues = (select: AstNode, expectedColumn: string): Set<string> =>
{
    const aliases = aliasesFor(select);
    const excluded = new Set<string>();
    walk(select.where, (node) =>
    {
        if (node.type !== 'binary_expr') return;
        const column = resolvedColumn(node.left, aliases);
        if (!column || !identifierMatches(column, expectedColumn)) return;
        if (lower(node.operator) === 'not in')
        {
            for (const value of stringValues(node.right)) excluded.add(value);
        }
        else if (['!=', '<>'].includes(node.operator) && node.right?.type === 'single_quote_string')
        {
            excluded.add(String(node.right.value));
        }
    });
    return excluded;
};

export const evaluateSqlSemantics = (assertion: SqlAssertion, sql: string): string | undefined =>
{
    try
    {
        const selects = parsedSelects(sql);
        let passed = false;
        if (assertion.operator === 'has_join')
        {
            passed = selects.some((select) => hasJoin(select, assertion.expected.left, assertion.expected.right));
        }
        else if (assertion.operator === 'uses_time_field')
        {
            passed = selects.some((select) => usesTimeField(select, assertion.expected));
        }
        else if (assertion.operator === 'groups_by')
        {
            passed = selects.some((select) => groupsBy(select, assertion.expected));
        }
        else if (assertion.operator === 'projects_unit')
        {
            passed = selects.some((select) => projectsUnit(select, assertion.expected));
        }
        else
        {
            passed = selects.some((select) =>
            {
                const excluded = excludedValues(select, assertion.expected.column);
                return assertion.expected.values.every((value) => excluded.has(value));
            });
        }
        return passed
            ? undefined
            : `SQL did not satisfy ${assertion.operator} ${JSON.stringify(assertion.expected)}`;
    }
    catch (error)
    {
        const message = error instanceof Error ? error.message : 'SQL could not be inspected';
        return `SQL semantics could not be evaluated: ${message}`;
    }
};
