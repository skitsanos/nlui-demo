import {Parser} from 'node-sql-parser/umd/sqlite.umd';
import {rejectSqlComments, validateQueryFields} from './queryFields.ts';
import {validateSelectSources} from './queryJoins.ts';
import {selectProvesEquality} from './queryPredicateProof.ts';
import {
    HIDDEN_QUERY_COLUMNS,
    QUERY_FUNCTIONS,
    QUERY_TABLES,
    type QueryTableName
} from './querySchema.ts';
import {DatasetQueryError} from './queryTypes.ts';

type AstNode = Record<string, any>;

const parser = new Parser();
const TABLES = new Set<string>(Object.keys(QUERY_TABLES));
const FUNCTIONS = new Set<string>(QUERY_FUNCTIONS);
const HIDDEN_COLUMNS = new Set<string>(HIDDEN_QUERY_COLUMNS);
const MAX_SQL_LENGTH = 6_000;
const MAX_AST_NODES = 800;
const MAX_SELECTS = 5;
const MAX_CTES = 4;
const MAX_JOINS = 4;
const OUTPUT_ALIAS = /^_?[a-z][a-z0-9_]{0,62}$/;

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

const validateSelectColumns = (select: AstNode, allowCanonicalQuotes: boolean): void =>
{
    if (!Array.isArray(select.columns) || select.columns.length === 0)
    {
        policyError('Every SELECT must project at least one named column.');
    }
    for (const item of select.columns)
    {
        if (!isNode(item) || !isNode(item.expr)) policyError('Malformed SELECT columns are not allowed.');
        const simpleColumn = item.expr.type === 'column_ref'
            || (allowCanonicalQuotes && item.expr.type === 'double_quote_string');
        if (!simpleColumn && typeof item.as !== 'string')
        {
            policyError('Every computed result column must have a descriptive snake_case alias.');
        }
        if (typeof item.as === 'string' && !OUTPUT_ALIAS.test(item.as))
        {
            policyError('Result aliases must use short snake_case names.');
        }
    }
};

const validateAst = (ast: AstNode, allowCanonicalQuotes = false, allowParameters = false): void =>
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
            validateSelectColumns(node, allowCanonicalQuotes);
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
        else if (!allowParameters
            && (node.type === 'param' || (node.type === 'origin' && /^[?$:@]/.test(String(node.value)))))
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
    validateQueryFields(ast, allowCanonicalQuotes);
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

export const canonicalizeDatasetQuery = (sql: string, options: {allowParameters?: boolean} = {}): string =>
{
    const trimmed = sql.trim();
    if (!trimmed) policyError('The generated query is empty.');
    if (trimmed.length > MAX_SQL_LENGTH) policyError(`SQL is limited to ${MAX_SQL_LENGTH.toLocaleString()} characters.`);
    rejectSqlComments(trimmed);

    const ast = parseOne(trimmed);
    validateAst(ast, false, options.allowParameters);
    const canonical = parser.sqlify(ast as any, {database: 'sqlite'});
    const reparsed = parseOne(canonical);
    validateAst(reparsed, true, options.allowParameters);
    return canonical;
};

export const inspectDatasetQuery = (sql: string): AstNode => parseOne(canonicalizeDatasetQuery(sql));

export const datasetQueryHasWhereEquality = (sql: string, column: string, expected: string): boolean =>
{
    return selectProvesEquality(inspectDatasetQuery(sql), column, expected);
};

export const isPublishedQueryTable = (value: string): value is QueryTableName => TABLES.has(value);
