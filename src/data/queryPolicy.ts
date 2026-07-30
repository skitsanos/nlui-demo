import {Parser} from 'node-sql-parser/umd/sqlite.umd';
import {
    HIDDEN_QUERY_COLUMNS,
    QUERY_FUNCTIONS,
    QUERY_RELATIONSHIPS,
    QUERY_TABLES,
    type QueryTableName
} from './querySchema.ts';
import {DatasetQueryError} from './queryTypes.ts';

type AstNode = Record<string, any>;

const parser = new Parser();
const TABLES = new Set<string>(Object.keys(QUERY_TABLES));
const FUNCTIONS = new Set<string>(QUERY_FUNCTIONS);
const HIDDEN_COLUMNS = new Set<string>(HIDDEN_QUERY_COLUMNS);
const RELATIONSHIPS = new Set<string>(QUERY_RELATIONSHIPS.map(([left, right]) => [left, right].sort().join('=')));
const MAX_SQL_LENGTH = 6_000;
const MAX_AST_NODES = 800;
const MAX_SELECTS = 5;
const MAX_CTES = 4;
const MAX_JOINS = 4;

const isNode = (value: unknown): value is AstNode => typeof value === 'object' && value !== null;
const lower = (value: unknown): string => String(value ?? '').toLowerCase();

const policyError = (message: string): never =>
{
    throw new DatasetQueryError('SQL_POLICY', message);
};

const walkAst = (value: unknown, visit: (node: AstNode) => void, depth = 0): void =>
{
    if (depth > 30)
    {
        policyError('The generated query is too deeply nested.');
    }
    if (Array.isArray(value))
    {
        for (const item of value) walkAst(item, visit, depth + 1);
        return;
    }
    if (!isNode(value)) return;
    visit(value);
    for (const child of Object.values(value)) walkAst(child, visit, depth + 1);
};

const functionName = (node: AstNode): string =>
{
    if (node.type === 'aggr_func') return lower(node.name);
    const parts = node.name?.name;
    if (!Array.isArray(parts) || parts.length !== 1 || parts[0]?.schema)
    {
        policyError('Schema-qualified or malformed functions are not allowed.');
    }
    return lower(parts[0]?.value);
};

const cteName = (item: AstNode): string => lower(item.name?.value);

const collectCtes = (ast: AstNode): Set<string> =>
{
    const names = new Set<string>();
    walkAst(ast, (node) =>
    {
        if (node.type !== 'select' || !Array.isArray(node.with)) return;
        for (const item of node.with)
        {
            const name = cteName(item);
            if (!/^[a-z][a-z0-9_]{0,62}$/.test(name) || TABLES.has(name) || name.startsWith('sqlite_'))
            {
                policyError('CTE names must be short, distinct, and separate from published tables.');
            }
            if (item.recursive || item.stmt?.recursive)
            {
                policyError('Recursive CTEs are not allowed.');
            }
            if (names.has(name)) policyError('Duplicate CTE names are not allowed.');
            names.add(name);
        }
    });
    if (names.size > MAX_CTES) policyError(`At most ${MAX_CTES} CTEs are allowed.`);
    return names;
};

const columnReference = (node: AstNode): {table: string; column: string} | null =>
{
    if (node.type !== 'column_ref' || typeof node.column !== 'string') return null;
    return {table: lower(node.table), column: lower(node.column)};
};

const containsOperator = (value: unknown, operator: string): boolean =>
{
    let found = false;
    walkAst(value, (node) =>
    {
        if (node.type === 'binary_expr' && lower(node.operator) === operator.toLowerCase()) found = true;
    });
    return found;
};

const hasApprovedJoin = (on: AstNode, aliases: Map<string, string>, joinedTable: string): boolean =>
{
    let approved = false;
    walkAst(on, (node) =>
    {
        if (node.type !== 'binary_expr' || node.operator !== '=') return;
        const left = columnReference(node.left);
        const right = columnReference(node.right);
        if (!left?.table || !right?.table) return;
        const leftTable = aliases.get(left.table);
        const rightTable = aliases.get(right.table);
        if (!leftTable || !rightTable) return;
        const relationship = [`${leftTable}.${left.column}`, `${rightTable}.${right.column}`].sort().join('=');
        if (RELATIONSHIPS.has(relationship) && (leftTable === joinedTable || rightTable === joinedTable))
        {
            approved = true;
        }
    });
    return approved;
};

const validateSelectSources = (select: AstNode, ctes: Set<string>): number =>
{
    const sources = select.from;
    if (sources === null || sources === undefined) return 0;
    if (!Array.isArray(sources) || sources.length === 0) policyError('Malformed query sources are not allowed.');

    const aliases = new Map<string, string>();
    for (const source of sources)
    {
        if (!isNode(source) || source.expr || typeof source.table !== 'string')
        {
            policyError('Derived and table-valued FROM sources are not allowed.');
        }
        if (source.db || source.schema)
        {
            policyError('Schema-qualified table names are not allowed.');
        }
        const table = lower(source.table);
        if (!TABLES.has(table) && !ctes.has(table))
        {
            policyError('The query referenced a table outside the published dataset schema.');
        }
        const alias = lower(source.as) || table;
        if (!/^[a-z][a-z0-9_]{0,62}$/.test(alias) || aliases.has(alias))
        {
            policyError('Table aliases must be short and unique within a SELECT.');
        }
        aliases.set(alias, table);
        if (!aliases.has(table)) aliases.set(table, table);
    }

    let joins = 0;
    for (const [index, source] of sources.entries())
    {
        if (index === 0)
        {
            if (source.join) policyError('The first FROM source cannot be a join.');
            continue;
        }
        joins += 1;
        const table = lower(source.table);
        if (!source.join || !source.on || source.using || ctes.has(table))
        {
            policyError('Every additional table must use an explicit relationship JOIN.');
        }
        if (!['inner join', 'left join'].includes(lower(source.join)))
        {
            policyError('Only INNER JOIN and LEFT JOIN are allowed.');
        }
        if (containsOperator(source.on, 'or') || !hasApprovedJoin(source.on, aliases, table))
        {
            policyError('JOIN conditions must use a published foreign-key relationship without OR.');
        }
    }
    return joins;
};

const validateAst = (ast: AstNode, allowCanonicalQuotes = false): void =>
{
    if (lower(ast.type) !== 'select') policyError('Only a SELECT statement is allowed.');
    const ctes = collectCtes(ast);
    let nodeCount = 0;
    let selectCount = 0;
    let joinCount = 0;
    let physicalSourceCount = 0;

    walkAst(ast, (node) =>
    {
        nodeCount += 1;
        if (nodeCount > MAX_AST_NODES) policyError('The generated query is too complex.');

        if (node.type === 'select')
        {
            selectCount += 1;
            if (node._next || node.set_op) policyError('Compound SELECT statements are not allowed.');
            if (node.into || node.for_update || node.options) policyError('This SELECT option is not allowed.');
            joinCount += validateSelectSources(node, ctes);
            for (const source of node.from ?? [])
            {
                if (TABLES.has(lower(source.table))) physicalSourceCount += 1;
            }
        }
        else if (node.type === 'function' || node.type === 'aggr_func')
        {
            const name = functionName(node);
            if (!FUNCTIONS.has(name)) policyError(`The SQL function ${name || '(unknown)'} is not allowed.`);
            if (node.over) policyError('Window functions are not allowed.');
        }
        else if (node.type === 'column_ref')
        {
            const column = lower(node.column);
            if (column === '*') policyError('Wildcard column selection is not allowed; name columns explicitly.');
            if (HIDDEN_COLUMNS.has(column)) policyError('That column is outside the published analytics schema.');
            if (node.collate) policyError('Custom collations are not allowed.');
        }
        else if (node.type === 'param' || (node.type === 'origin' && /^[?$:@]/.test(String(node.value))))
        {
            policyError('SQL parameters are not allowed.');
        }
        else if (node.type === 'double_quote_string' && !allowCanonicalQuotes)
        {
            policyError('Use single quotes for string literals and bare names for published columns.');
        }
        else if (node.type === 'cast')
        {
            const targets = Array.isArray(node.target) ? node.target : [];
            if (targets.some((target: AstNode) => !['integer', 'numeric', 'real', 'text'].includes(lower(target.dataType))))
            {
                policyError('Only INTEGER, NUMERIC, REAL, and TEXT casts are allowed.');
            }
        }
    });

    if (selectCount > MAX_SELECTS) policyError(`At most ${MAX_SELECTS} SELECT scopes are allowed.`);
    if (joinCount > MAX_JOINS) policyError(`At most ${MAX_JOINS} relationship joins are allowed.`);
    if (physicalSourceCount === 0) policyError('The query must read at least one published dataset table.');
};

const parseOne = (sql: string): AstNode =>
{
    try
    {
        const parsed = parser.astify(sql, {database: 'sqlite'});
        if (Array.isArray(parsed))
        {
            if (parsed.length !== 1) policyError('Exactly one SELECT statement is allowed.');
            return parsed[0] as unknown as AstNode;
        }
        return parsed as unknown as AstNode;
    }
    catch (error)
    {
        if (error instanceof DatasetQueryError) throw error;
        throw new DatasetQueryError('SQL_INVALID', 'The generated SQL could not be parsed as SQLite.');
    }
};

export const canonicalizeDatasetQuery = (sql: string): string =>
{
    const trimmed = sql.trim();
    if (!trimmed) policyError('The generated query is empty.');
    if (trimmed.length > MAX_SQL_LENGTH) policyError(`SQL is limited to ${MAX_SQL_LENGTH.toLocaleString()} characters.`);

    const ast = parseOne(trimmed);
    validateAst(ast);
    const canonical = parser.sqlify(ast as any, {database: 'sqlite'});
    const reparsed = parseOne(canonical);
    validateAst(reparsed, true);
    return canonical;
};

export const isPublishedQueryTable = (value: string): value is QueryTableName => TABLES.has(value);
