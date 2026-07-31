import {Tag} from 'antd';
import type {CellValue, ValueFormat} from '../../nlui/types.ts';
import {formatTemporalValue} from '../dateFormat.ts';

interface Props
{
    value: CellValue | undefined;
    format?: ValueFormat;
}

const currency = new Intl.NumberFormat('en', {style: 'currency', currency: 'EUR'});
const number = new Intl.NumberFormat('en', {maximumFractionDigits: 2});

const statusColor = (value: string): string => /complete|delivered|success/i.test(value) ? 'green'
    : /delay|cancel|failed|return/i.test(value) ? 'red'
        : 'blue';

export const FormattedValue = ({value, format}: Props) =>
{
    if (value === null || value === undefined) return <>—</>;
    if (format === 'date')
    {
        const formatted = formatTemporalValue(value);
        if (formatted)
        {
            return <time dateTime={formatted.dateTime} title={`Original value: ${value}`}>{formatted.text}</time>;
        }
    }
    if (format === 'currency' && typeof value === 'number') return <>{currency.format(value)}</>;
    if (format === 'number' && typeof value === 'number') return <>{number.format(value)}</>;
    if (format === 'status') return <Tag color={statusColor(String(value))}>{String(value)}</Tag>;
    return <>{String(value)}</>;
};
