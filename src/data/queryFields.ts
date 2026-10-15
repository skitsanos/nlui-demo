import {QUERY_TABLES} from './querySchema.ts';
import {DatasetQueryError} from './queryTypes.ts';

type Node = Record<string, any>;
type Fields = Map<string, Set<string>>;
const name = (value: unknown): string => String(value ?? '').toLowerCase();
const reject = (): never => {throw new DatasetQueryError('SQL_POLICY', 'Every column must resolve unambiguously to an in-scope published field.');};
const node = (value: unknown): value is Node => typeof value === 'object' && value !== null;
const identifier = (value: unknown): string =>
{
    const result = name(value);
    if (!/^[a-z_][a-z0-9_]{0,62}$/.test(result)) reject();
    return result;
};

// Lexical CTE scopes and output-field lineage are separate from the looser
// predicate-proof resolver. Unsupported/correlated scopes fail closed here.
export const validateQueryFields = (root: Node, canonicalQuotes = false): void =>
{
    const select = (ast: Node, inherited: Fields = new Map()): Set<string> =>
    {
        const ctes: Fields = new Map(inherited);
        for (const cte of ast.with ?? [])
        {
            const id = identifier(cte.name?.value);
            if (ctes.has(id) || Object.hasOwn(QUERY_TABLES, id) || cte.columns?.length) reject();
            ctes.set(id, select(cte.stmt?.ast ?? cte.stmt, ctes));
        }
        const sources: Fields = new Map();
        for (const source of ast.from ?? [])
        {
            const table = identifier(source.table);
            const alias = identifier(source.as ?? table);
            if (sources.has(alias)) reject();
            const fields = Object.hasOwn(QUERY_TABLES, table)
                ? new Set<string>(QUERY_TABLES[table as keyof typeof QUERY_TABLES]) : ctes.get(table);
            if (!fields) reject();
            sources.set(alias, fields!);
        }
        const aliases = new Set<string>();
        const output = new Set<string>();
        for (const column of ast.columns ?? [])
        {
            const id = column.as ?? (column.expr?.type === 'column_ref' ? column.expr.column
                : canonicalQuotes && column.expr?.type === 'double_quote_string' ? column.expr.value : undefined);
            if (id === undefined || output.has(identifier(id))) reject();
            output.add(identifier(id));
            if (column.as) aliases.add(identifier(column.as));
        }
        const expression = (value: unknown, allowOutput: boolean | 'prefer' = false): void =>
        {
            if (Array.isArray(value)) {for (const child of value) expression(child, allowOutput); return;}
            if (!node(value)) return;
            if (value.type === 'select') {select(value, ctes); return;}
            if (value.type === 'column_ref' || (canonicalQuotes && value.type === 'double_quote_string'))
            {
                const field = identifier(value.column ?? value.value);
                const qualifier = value.table ? identifier(value.table) : '';
                if (qualifier)
                {
                    if (!sources.get(qualifier)?.has(field)) reject();
                }
                else
                {
                    // SQLite ORDER BY resolves an explicit result alias before source columns.
                    // GROUP BY/HAVING retain physical-field precedence and fail ambiguous sources.
                    if (allowOutput === 'prefer' && aliases.has(field)) return;
                    const matches = [...sources.values()].filter((fields) => fields.has(field));
                    if (matches.length !== 1 && !(allowOutput && matches.length === 0 && aliases.has(field))) reject();
                }
                return;
            }
            for (const [key, child] of Object.entries(value))
            {
                if (key === 'tableList' || key === 'columnList') continue;
                expression(child, allowOutput);
            }
        };
        expression(ast.columns);
        expression(ast.where);
        for (const source of ast.from ?? []) expression(source.on);
        expression(ast.groupby, true);
        expression(ast.having, true);
        expression(ast.orderby, 'prefer');
        const limits = ast.limit?.value ?? [];
        for (const limit of limits)
        {
            if (limit.type !== 'number' || !Number.isSafeInteger(Number(limit.value)) || Number(limit.value) < 0 || Number(limit.value) > 1000) reject();
        }
        return output;
    };
    select(root);
};

export const rejectSqlComments = (sql: string): void =>
{
    let quote = '';
    for (let index = 0; index < sql.length; index++)
    {
        const char = sql[index]!;
        if (quote)
        {
            if (char === quote) {if (sql[index + 1] === quote) index++; else quote = '';}
            continue;
        }
        if (char === "'" || char === '"' || char === '`' || char === '[') {quote = char === '[' ? ']' : char; continue;}
        if ((char === '-' && sql[index + 1] === '-') || (char === '/' && sql[index + 1] === '*'))
            throw new DatasetQueryError('SQL_POLICY', 'SQL comments are not allowed.');
    }
};
