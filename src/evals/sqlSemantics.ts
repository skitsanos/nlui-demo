import {inspectDatasetQuery} from '../data/queryPolicy.ts';
import {predicateImplies, selectProvesExclusions, selectProvesTimeFilter} from '../data/queryPredicateProof.ts';
import {
    type SqlNode as AstNode,
    type ColumnResolver,
    columnsForSelect,
    sqlIdentifierMatches as identifierMatches,
    lowerSqlName as lower,
    walkSqlExpression as walk
} from '../data/queryScope.ts';
import type {DeterministicAssertion} from './assertionSchema.ts';
import {groupingProvesGrain, projectionProvesUnit} from './sqlExpressionProof.ts';

type SqlAssertion = Extract<DeterministicAssertion, {source: 'sql_semantics'}>;

const expressionHasColumn = (value: unknown, expected: string, resolve: ColumnResolver): boolean =>
{
    let found = false;
    walk(value, (node) =>
    {
        const column = resolve(node);
        if (column && identifierMatches(column, expected)) found = true;
    });
    return found;
};

const hasJoin = (select: AstNode, left: string, right: string): boolean =>
{
    const resolve = columnsForSelect(select);
    for (const source of select.from ?? [])
    {
        if (predicateImplies(source.on, (node) =>
        {
            if (node.operator !== '=') return false;
            const observedLeft = resolve(node.left);
            const observedRight = resolve(node.right);
            return (identifierMatches(observedLeft, left) && identifierMatches(observedRight, right))
                || (identifierMatches(observedLeft, right) && identifierMatches(observedRight, left));
        })) return true;
    }
    return false;
};

const usesTimeField = (
    select: AstNode,
    expected: Extract<SqlAssertion, {operator: 'uses_time_field'}>['expected']
): boolean =>
{
    const resolve = columnsForSelect(select);
    if (expected.clause === 'filter') return selectProvesTimeFilter(select, expected.column);
    if (expected.clause === 'group')
    {
        if (expressionHasColumn(select.groupby, expected.column, resolve)) return true;
        const groupedAliases = new Set<string>();
        walk(select.groupby, (node) =>
        {
            if (node.type === 'column_ref' && !node.table) groupedAliases.add(lower(node.column));
            else if (node.type === 'double_quote_string') groupedAliases.add(lower(node.value));
        });
        return (select.columns ?? []).some((projection: AstNode) =>
            groupedAliases.has(lower(projection.as))
            && expressionHasColumn(projection.expr, expected.column, resolve)
        );
    }
    return [select.columns, select.where, select.groupby, select.having, select.orderby]
        .some((part) => expressionHasColumn(part, expected.column, resolve));
};


export const evaluateSqlSemantics = (assertion: SqlAssertion, sql: string): string | undefined =>
{
    try
    {
        const select = inspectDatasetQuery(sql);
        let passed = false;
        if (assertion.operator === 'has_join')
        {
            passed = hasJoin(select, assertion.expected.left, assertion.expected.right);
        }
        else if (assertion.operator === 'uses_time_field')
        {
            passed = usesTimeField(select, assertion.expected);
        }
        else if (assertion.operator === 'groups_by')
        {
            passed = groupingProvesGrain(select, assertion.expected);
        }
        else if (assertion.operator === 'projects_unit')
        {
            passed = projectionProvesUnit(select, assertion.expected);
        }
        else
        {
            passed = selectProvesExclusions(select, assertion.expected.column, assertion.expected.values);
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
