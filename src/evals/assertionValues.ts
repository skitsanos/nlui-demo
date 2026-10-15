export const valueAtPath = (source: unknown, path: string): unknown =>
{
    const [part, ...rest] = path.split('.');
    if (part === '*') return Array.isArray(source)
        ? source.map((item) => rest.length ? valueAtPath(item, rest.join('.')) : item) : undefined;
    if (typeof source !== 'object' || source === null || !Object.hasOwn(source, part!)) return undefined;
    const value = (source as Record<string, unknown>)[part!];
    return rest.length ? valueAtPath(value, rest.join('.')) : value;
};

export const collectionCheck = (operator: string, observed: unknown, expected: unknown): boolean | undefined =>
{
    const present = (value: unknown) => value !== undefined && value !== null;
    if (operator === 'exists') return present(observed) === expected;
    if (operator === 'matches')
    {
        try {return typeof observed === 'string' && typeof expected === 'string' && new RegExp(expected).test(observed);}
        catch {return false;}
    }
    if (!['every_equals', 'every_gte', 'every_lte', 'every_present', 'length_lte', 'descending', 'some_equals', 'some_matches'].includes(operator))
    {
        return undefined;
    }
    if (!Array.isArray(observed)) return false;
    if (operator === 'length_lte') return typeof expected === 'number' && observed.length <= expected;
    if (observed.length === 0) return false; // Never turn absence into positive predicate evidence.
    if (operator === 'every_present') return observed.every(present);
    if (operator === 'every_equals') return observed.every((value) => value === expected);
    if (operator === 'some_equals') return observed.some((value) => value === expected);
    if (operator === 'some_matches')
    {
        try {return typeof expected === 'string' && observed.some((value) => typeof value === 'string' && new RegExp(expected).test(value));}
        catch {return false;}
    }
    if (operator === 'descending') return observed.every((value, index) =>
        (typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)))
        && (index === 0 || (typeof value === typeof observed[index - 1] && value <= observed[index - 1])));
    return typeof expected === 'number' && observed.every((value) => typeof value === 'number'
        && Number.isFinite(value) && (operator === 'every_gte' ? value >= expected : value <= expected));
};
