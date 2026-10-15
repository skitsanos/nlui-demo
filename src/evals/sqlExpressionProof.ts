import {type ColumnResolver, columnsForSelect, type SqlNode, sqlIdentifierMatches} from '../data/queryScope.ts';

const literalNumber = (node: SqlNode | undefined): number | undefined =>
    node?.type === 'number' && Number.isFinite(Number(node.value)) ? Number(node.value) : undefined;

// Track scaling along the whole expression. A divisor in another branch is not evidence.
const sourceScale = (node: SqlNode | undefined, column: string, resolve: ColumnResolver): number | undefined =>
{
    if (!node) return undefined;
    if (sqlIdentifierMatches(resolve(node), column)) return 1;
    if (node.type === 'aggr_func' && ['SUM', 'AVG', 'MIN', 'MAX'].includes(String(node.name).toUpperCase()))
    {
        return sourceScale(node.args?.expr, column, resolve);
    }
    if (node.type === 'function')
    {
        const name = String(node.name?.name?.[0]?.value).toLowerCase();
        const args = node.args?.value;
        if (!Array.isArray(args)) return undefined;
        if (name === 'round' && args.length <= 2 && (args.length === 1 || literalNumber(args[1]) !== undefined))
        {
            return sourceScale(args[0], column, resolve);
        }
        if (['coalesce', 'ifnull'].includes(name) && args.length === 2 && literalNumber(args[1]) === 0)
        {
            return sourceScale(args[0], column, resolve);
        }
    }
    if (node.type === 'binary_expr' && node.operator === '/')
    {
        const scale = sourceScale(node.left, column, resolve);
        const divisor = literalNumber(node.right);
        if (scale !== undefined && divisor !== undefined && divisor !== 0) return scale / divisor;
    }
    return undefined;
};

export const projectionProvesUnit = (select: SqlNode, expected: {sourceColumn: string; outputAlias?: string; divisor?: number}): boolean =>
{
    const resolve = columnsForSelect(select);
    return (select.columns ?? []).some((projection: SqlNode) =>
    {
        if (expected.outputAlias !== undefined && projection.as?.toLowerCase() !== expected.outputAlias) return false;
        const scale = sourceScale(projection.expr, expected.sourceColumn, resolve);
        return scale !== undefined && scale === 1 / (expected.divisor ?? 1);
    });
};

export const groupingProvesGrain = (select: SqlNode, expected: string[]): boolean =>
{
    const resolve = columnsForSelect(select);
    const expressions = select.groupby?.columns;
    if (!Array.isArray(expressions) || expressions.length !== expected.length) return false;
    const actual = expressions.map((expression: SqlNode) =>
    {
        const direct = resolve(expression);
        if (direct) return direct;
        const alias = expression.type === 'double_quote_string' ? expression.value
            : expression.type === 'column_ref' && !expression.table ? expression.column : undefined;
        const projection = select.columns?.find((item: SqlNode) => item.as === alias);
        return resolve(projection?.expr);
    });
    return actual.every((column: string | undefined) => column !== undefined)
        && expected.every((column) => actual.some((item: string) => sqlIdentifierMatches(item, column)));
};
