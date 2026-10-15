import {type ColumnResolver, columnsForSelect, lowerSqlName, type SqlNode, sqlIdentifierMatches} from './queryScope.ts';

// If a WHERE expression is TRUE, the requested fact must hold. Unknown constructs
// never constitute proof. This is intentionally not a complete SQL theorem prover.
export const predicateImplies = (node: SqlNode | undefined, atom: (node: SqlNode) => boolean): boolean =>
{
    if (node?.type !== 'binary_expr') return false;
    const operator = lowerSqlName(node.operator);
    if (operator === 'and') return predicateImplies(node.left, atom) || predicateImplies(node.right, atom);
    if (operator === 'or') return predicateImplies(node.left, atom) && predicateImplies(node.right, atom);
    return atom(node);
};

const stringLiteral = (node: SqlNode | undefined): string | undefined =>
    node?.type === 'single_quote_string' && !node.collate && typeof node.value === 'string'
        ? node.value : undefined;

const literalList = (node: SqlNode | undefined): string[] | undefined =>
{
    if (node?.type !== 'expr_list' || !Array.isArray(node.value) || node.value.length === 0) return undefined;
    const values = node.value.map(stringLiteral);
    return values.every((value: string | undefined) => value !== undefined) ? values as string[] : undefined;
};

const columnAndLiteral = (
    node: SqlNode,
    column: string,
    resolve: ColumnResolver
): string | undefined =>
{
    if (sqlIdentifierMatches(resolve(node.left), column)) return stringLiteral(node.right);
    if (sqlIdentifierMatches(resolve(node.right), column)) return stringLiteral(node.left);
    return undefined;
};

export const selectProvesEquality = (select: SqlNode, column: string, expected: string): boolean =>
{
    const resolve = columnsForSelect(select);
    return predicateImplies(select.where, (node) =>
        node.operator === '=' && columnAndLiteral(node, lowerSqlName(column), resolve) === expected
    );
};

export const selectProvesExclusions = (select: SqlNode, column: string, values: string[]): boolean =>
{
    const resolve = columnsForSelect(select);
    return values.every((value) => predicateImplies(select.where, (node) =>
    {
        if (['!=', '<>'].includes(node.operator)) return columnAndLiteral(node, column, resolve) === value;
        return lowerSqlName(node.operator) === 'not in'
            && sqlIdentifierMatches(resolve(node.left), column)
            && literalList(node.right)?.includes(value) === true;
    }));
};

export const selectProvesTimeFilter = (select: SqlNode, column: string): boolean =>
{
    const resolve = columnsForSelect(select);
    return predicateImplies(select.where, (node) =>
    {
        const operator = lowerSqlName(node.operator);
        if (['=', '!=', '<>', '>', '>=', '<', '<='].includes(operator))
        {
            return columnAndLiteral(node, column, resolve) !== undefined;
        }
        if (!sqlIdentifierMatches(resolve(node.left), column)) return false;
        const values = literalList(node.right);
        return values !== undefined && (['in', 'not in'].includes(operator)
            || (['between', 'not between'].includes(operator) && values.length === 2));
    });
};
