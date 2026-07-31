import {Empty, Tooltip, Typography} from 'antd';
import type {ChartBlock} from '../../nlui/types.ts';
import {formatTemporalValue} from '../dateFormat.ts';

const WIDTH = 640;
const HEIGHT = 220;
const PADDING = {top: 18, right: 18, bottom: 42, left: 52};

interface ChartPoint
{
    id: string;
    label: string;
    axisLabel: string;
    value: number;
}

const compactNumber = new Intl.NumberFormat('en', {notation: 'compact', maximumFractionDigits: 1});
const compactDate = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC'
});

const compactTemporalLabel = (rawLabel: string, dateTime: string, formattedLabel: string): string =>
{
    if (/^\d{4}-\d{2}$/.test(rawLabel)) return formattedLabel;
    const normalized = dateTime.length === 10 ? `${dateTime}T00:00:00.000Z` : dateTime;
    return compactDate.format(new Date(normalized));
};

const toPoints = (block: ChartBlock): ChartPoint[] =>
{
    const occurrences = new Map<string, number>();
    return block.data.slice(0, 24).map((item) =>
    {
        const rawLabel = String(item[block.categoryKey] ?? '');
        const temporal = block.categoryFormat === 'date' ? formatTemporalValue(rawLabel) : undefined;
        const label = temporal?.text ?? rawLabel;
        const axisLabel = temporal
            ? compactTemporalLabel(rawLabel, temporal.dateTime, label)
            : label.length > 10 ? `${label.slice(0, 9)}…` : label;
        const count = (occurrences.get(rawLabel) ?? 0) + 1;
        occurrences.set(rawLabel, count);
        return {id: `${rawLabel}-${count}`, label, axisLabel, value: Number(item[block.valueKey] ?? 0)};
    }).filter((item) => Number.isFinite(item.value));
};

export const MiniChart = ({block}: {block: ChartBlock}) =>
{
    const points = toPoints(block);
    if (points.length === 0)
    {
        return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No chart data"/>;
    }

    const max = Math.max(0, ...points.map(({value}) => value));
    const min = Math.min(0, ...points.map(({value}) => value));
    const range = max - min || 1;
    const innerWidth = WIDTH - PADDING.left - PADDING.right;
    const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
    const step = innerWidth / points.length;
    const y = (value: number): number => PADDING.top + ((max - value) / range) * innerHeight;
    const baseline = y(0);
    const linePoints = points.map(({value}, index) => `${PADDING.left + step * (index + 0.5)},${y(value)}`).join(' ');
    const ticks = [
        {id: 'maximum', value: max},
        {id: 'middle', value: min + range / 2},
        {id: 'minimum', value: min}
    ];

    return (
        <div className="mini-chart">
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={block.title ?? 'Data chart'}>
                <title>{block.title ?? 'Data chart'}</title>
                <desc>{points.map(({label, value}) => `${label}: ${value}`).join('; ')}</desc>
                {ticks.map((tick) =>
                    <g key={tick.id}>
                        <line
                            x1={PADDING.left}
                            x2={WIDTH - PADDING.right}
                            y1={y(tick.value)}
                            y2={y(tick.value)}
                            className="chart-grid"
                        />
                        <text x={PADDING.left - 8} y={y(tick.value) + 4} className="chart-axis" textAnchor="end">
                            {compactNumber.format(tick.value)}
                        </text>
                    </g>
                )}

                {block.variant === 'bar' && points.map((point, index) =>
                    <Tooltip key={point.id} title={`${point.label}: ${point.value.toLocaleString()}`}>
                        <rect
                            x={PADDING.left + step * index + step * 0.18}
                            y={Math.min(y(point.value), baseline)}
                            width={step * 0.64}
                            height={Math.abs(baseline - y(point.value))}
                            rx="5"
                            className="chart-bar"
                        />
                    </Tooltip>
                )}

                {block.variant === 'line' && <>
                    <polyline points={linePoints} className="chart-line"/>
                    {points.map((point, index) =>
                        <Tooltip key={point.id} title={`${point.label}: ${point.value.toLocaleString()}`}>
                            <circle
                                cx={PADDING.left + step * (index + 0.5)}
                                cy={y(point.value)}
                                r="4"
                                className="chart-dot"
                            />
                        </Tooltip>
                    )}
                </>}

                {points.map((point, index) =>
                    <text
                        key={`${point.id}-label`}
                        x={PADDING.left + step * (index + 0.5)}
                        y={HEIGHT - 16}
                        className="chart-axis"
                        textAnchor="middle"
                    >
                        {point.axisLabel}
                    </text>
                )}
            </svg>
            {block.valueLabel && <Typography.Text type="secondary" className="chart-caption">{block.valueLabel}</Typography.Text>}
        </div>
    );
};
