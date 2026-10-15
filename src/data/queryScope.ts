import {QUERY_TABLES, type QueryTableName} from './querySchema.ts';

export type SqlNode = Record<string, any>;
export type ColumnResolver = (node: SqlNode | undefined) => string | undefined;

export const lowerSqlName = (value: unknown): string => String(value ?? '').toLowerCase();

// Inspect one expression scope only; subqueries cannot establish facts about its rows.
export const walkSqlExpression = (value: unknown, visit: (node: SqlNode) => void): void =>
{
    if (Array.isArray(value))
    {
        for (const item of value) walkSqlExpression(item, visit);
        return;
    }
    if (typeof value !== 'object' || value === null) return;
    const node = value as SqlNode;
    if (node.type === 'select') return;
    visit(node);
    for (const child of Object.values(node)) walkSqlExpression(child, visit);
};

export const sqlIdentifierMatches = (actual: string | undefined, expected: string): boolean =>
    actual !== undefined && (expected.includes('.') ? actual === expected : actual.split('.').at(-1) === expected);

export const columnsForSelect = (select: SqlNode): ColumnResolver =>
{
    const sources: Array<{alias: string; table: QueryTableName}> = [];
    for (const source of select.from ?? [])
    {
        const table = lowerSqlName(source.table);
        // CTE lineage and derived sources are deliberately unproven, not recursively guessed.
        if (!Object.hasOwn(QUERY_TABLES, table) || source.expr) return () => undefined;
        sources.push({alias: lowerSqlName(source.as ?? source.table), table: table as QueryTableName});
    }
    return (node) =>
    {
        if (!node || node.collate) return undefined;
        const column = node.type === 'column_ref' && typeof node.column === 'string'
            ? lowerSqlName(node.column)
            : node.type === 'double_quote_string' && typeof node.value === 'string'
                ? lowerSqlName(node.value) : undefined;
        if (!column) return undefined;
        const qualifier = lowerSqlName(node.table);
        const matches = sources.filter(({alias, table}) =>
            (!qualifier || qualifier === alias)
            && (QUERY_TABLES[table] as readonly string[]).includes(column)
        );
        if (matches.length !== 1) return undefined;
        const table = matches[0]!.table;
        // Assertions name physical tables, not instances of a self/repeated-table join.
        if (sources.filter((source) => source.table === table).length !== 1) return undefined;
        return `${table}.${column}`;
    };
};
