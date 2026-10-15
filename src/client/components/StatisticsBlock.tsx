import {ArrowDownRight, ArrowRight, ArrowUpRight} from '@phosphor-icons/react';
import {Card, Statistic, Typography} from 'antd';
import {useId} from 'react';
import type {StatsBlock} from '../../nlui/types.ts';
import {FormattedValue} from './FormattedValue.tsx';

export const StatisticsBlock = ({block}: {block: StatsBlock}) =>
{
    const id = useId();
    const titleId = `${id}-title`;
    const descriptionId = `${id}-description`;
    return <section className="nlui-stats" aria-labelledby={block.title ? titleId : undefined}
        aria-label={block.title ? undefined : 'Summary statistics'} aria-describedby={block.description ? descriptionId : undefined}>
        {block.title && <Typography.Title level={3} id={titleId} className="stat-block-title">{block.title}</Typography.Title>}
        {block.description && <Typography.Paragraph type="secondary" id={descriptionId} className="stat-block-description">
            {block.description}
        </Typography.Paragraph>}
        <div className="stat-grid">{block.items.map((item) => <Card size="small" key={item.label}
            className={`stat-card${item.format === 'date' ? ' stat-card-temporal' : ''}`}>
            <Statistic title={item.label} value={item.value} suffix={item.suffix}
                formatter={item.format ? () => <FormattedValue value={item.value} format={item.format}/> : undefined}/>
            {item.trend && <span className={`trend trend-${item.trend}`}>
                {item.trend === 'up' ? <ArrowUpRight/> : item.trend === 'down' ? <ArrowDownRight/> : <ArrowRight/>}
            </span>}
        </Card>)}</div>
    </section>;
};
