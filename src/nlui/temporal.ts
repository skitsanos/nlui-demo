const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_ONLY = /^(\d{4})-(\d{2})$/;
const TIMESTAMP = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/i;

export type ParsedTemporalValue =
    | {kind: 'date'; dateTime: string; instant: Date}
    | {kind: 'month'; dateTime: string; instant: Date}
    | {kind: 'timestamp'; dateTime: string; instant: Date; includeSeconds: boolean};

const validDate = (value: string): Date | undefined =>
{
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? undefined : parsed;
};

export const parseTemporalValue = (value: unknown): ParsedTemporalValue | undefined =>
{
    if (typeof value !== 'string') return undefined;

    if (DATE_ONLY.test(value))
    {
        const instant = validDate(value);
        return instant ? {kind: 'date', dateTime: value, instant} : undefined;
    }

    const monthOnly = MONTH_ONLY.exec(value);
    if (monthOnly)
    {
        const month = Number(monthOnly[2]);
        if (month < 1 || month > 12) return undefined;
        const instant = validDate(`${monthOnly[1]}-${monthOnly[2]}-01`);
        return instant ? {kind: 'month', dateTime: value, instant} : undefined;
    }

    const timestamp = TIMESTAMP.exec(value);
    if (!timestamp || !validDate(timestamp[1]!)) return undefined;
    const hour = Number(timestamp[2]);
    const minute = Number(timestamp[3]);
    const second = Number(timestamp[4] ?? 0);
    if (hour > 23 || minute > 59 || second > 59) return undefined;

    const fraction = timestamp[5] ? `.${timestamp[5].padEnd(3, '0')}` : '.000';
    const normalized = `${timestamp[1]}T${timestamp[2]}:${timestamp[3]}:${timestamp[4] ?? '00'}${fraction}${timestamp[6] ?? 'Z'}`;
    const instant = new Date(normalized);
    if (Number.isNaN(instant.getTime())) return undefined;
    return {
        kind: 'timestamp',
        dateTime: instant.toISOString(),
        instant,
        includeSeconds: second !== 0 || Number(timestamp[5] ?? 0) !== 0
    };
};

export const isSupportedTemporalValue = (value: unknown): boolean => parseTemporalValue(value) !== undefined;
