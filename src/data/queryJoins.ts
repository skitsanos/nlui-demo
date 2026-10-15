import {QUERY_RELATIONSHIPS, QUERY_TABLES} from './querySchema.ts';
import {DatasetQueryError} from './queryTypes.ts';

type AstNode = Record<string, any>;
const tables = new Set<string>(Object.keys(QUERY_TABLES));
const relationships = new Set<string>(QUERY_RELATIONSHIPS.map((pair) => [...pair].sort().join('=')));
const lower = (value: unknown): string => String(value ?? '').toLowerCase();
const isNode = (value: unknown): value is AstNode => typeof value === 'object' && value !== null;
const reject = (message: string): never => {throw new DatasetQueryError('SQL_POLICY', message);};

// A matching fragment under NOT, OR, CASE, a function or another comparison is
// not a required relationship. Only a direct equality or an AND conjunct proves it.
const hasRequiredRelationship = (on: AstNode, aliases: Map<string, string>, newAlias: string): boolean =>
{
    if (!isNode(on) || on.type !== 'binary_expr') return false;
    if (lower(on.operator) === 'and')
    {
        return hasRequiredRelationship(on.left, aliases, newAlias)
            || hasRequiredRelationship(on.right, aliases, newAlias);
    }
    if (on.operator !== '=') return false;
    const {left, right} = on;
    if (left?.type !== 'column_ref' || right?.type !== 'column_ref') return false;
    const leftAlias = lower(left.table);
    const rightAlias = lower(right.table);
    if (leftAlias === rightAlias || (leftAlias !== newAlias && rightAlias !== newAlias)) return false;
    const leftTable = aliases.get(leftAlias);
    const rightTable = aliases.get(rightAlias);
    if (!leftTable || !rightTable) return false;
    return relationships.has([
        `${leftTable}.${lower(left.column)}`, `${rightTable}.${lower(right.column)}`
    ].sort().join('='));
};

const validateConditionScope = (value: unknown, aliases: Map<string, string>, depth = 0): void =>
{
    if (depth > 30) reject('The generated query is too deeply nested.');
    if (Array.isArray(value))
    {
        for (const item of value) validateConditionScope(item, aliases, depth + 1);
        return;
    }
    if (!isNode(value)) return;
    if (value.type === 'select') reject('Subqueries in JOIN conditions are not allowed.');
    if (value.type === 'binary_expr' && lower(value.operator) === 'or')
    {
        reject('JOIN conditions must use a published foreign-key relationship without OR.');
    }
    if (value.type === 'column_ref' && value.table && !aliases.has(lower(value.table)))
    {
        reject('JOIN conditions may reference only the new source and previously introduced aliases.');
    }
    for (const child of Object.values(value)) validateConditionScope(child, aliases, depth + 1);
};

export const validateSelectSources = (select: AstNode, ctes: Set<string>): number =>
{
    const sources = select.from;
    if (sources === null || sources === undefined) return 0;
    if (!Array.isArray(sources) || sources.length === 0) reject('Malformed query sources are not allowed.');
    const aliases = new Map<string, string>();
    for (const [index, source] of sources.entries())
    {
        if (!isNode(source) || source.expr || typeof source.table !== 'string')
        {
            reject('Derived and table-valued FROM sources are not allowed.');
        }
        if (source.db || source.schema) reject('Schema-qualified table names are not allowed.');
        const table = lower(source.table);
        if (!tables.has(table) && !ctes.has(table))
        {
            reject('The query referenced a table outside the published dataset schema.');
        }
        const alias = lower(source.as) || table;
        if (!/^[a-z][a-z0-9_]{0,62}$/.test(alias) || aliases.has(alias))
        {
            reject('Table aliases must be short and unique within a SELECT.');
        }
        // Bind only the SQL-visible name, not an implicit physical-table alias.
        // Future aliases are intentionally not present while validating this ON.
        aliases.set(alias, table);
        if (index === 0)
        {
            if (source.join) reject('The first FROM source cannot be a join.');
            continue;
        }
        if (!source.join || !source.on || source.using || ctes.has(table))
        {
            reject('Every additional table must use an explicit relationship JOIN.');
        }
        if (!['inner join', 'left join'].includes(lower(source.join)))
        {
            reject('Only INNER JOIN and LEFT JOIN are allowed.');
        }
        validateConditionScope(source.on, aliases);
        if (!hasRequiredRelationship(source.on, aliases, alias))
        {
            reject('Every JOIN requires a positive foreign-key equality between its new alias and an earlier source.');
        }
    }
    return sources.length - 1;
};
