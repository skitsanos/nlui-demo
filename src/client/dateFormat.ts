import {parseTemporalValue} from '../nlui/temporal.ts';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
});

const monthFormatter = new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
});

const timeFormatter = (includeSeconds: boolean): Intl.DateTimeFormat => new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    ...includeSeconds && {second: '2-digit'},
    hourCycle: 'h23',
    timeZone: 'UTC',
    timeZoneName: 'short'
});

export interface FormattedTemporalValue
{
    dateTime: string;
    text: string;
}

export const formatTemporalValue = (value: unknown): FormattedTemporalValue | undefined =>
{
    const parsed = parseTemporalValue(value);
    if (!parsed) return undefined;
    if (parsed.kind === 'date') return {dateTime: parsed.dateTime, text: dateFormatter.format(parsed.instant)};
    if (parsed.kind === 'month') return {dateTime: parsed.dateTime, text: monthFormatter.format(parsed.instant)};
    return {
        dateTime: parsed.dateTime,
        text: `${dateFormatter.format(parsed.instant)}, ${timeFormatter(parsed.includeSeconds).format(parsed.instant)}`
    };
};
