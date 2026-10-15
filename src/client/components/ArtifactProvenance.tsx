import {Descriptions, Typography} from 'antd';
import type {ArtifactReceipt} from '../../analysis/artifacts.ts';
import {SEMANTIC_DIMENSIONS} from '../../data/semantic/catalog.ts';
import {FormattedValue} from './FormattedValue.tsx';

const label = (id: string): string => SEMANTIC_DIMENSIONS[id as keyof typeof SEMANTIC_DIMENSIONS]?.label ?? id.replaceAll('_', ' ');
export const ArtifactProvenance = ({receipt}: {receipt: ArtifactReceipt}) => <>
    <Descriptions size="small" column={1} items={[
        {key: 'metric', label: 'Definition', children: receipt.definition},
        {key: 'dataset', label: 'Snapshot', children: <>{receipt.dataset} · <FormattedValue value={receipt.snapshot} format="date"/></>},
        {key: 'grain', label: 'Grain / units', children: `${receipt.grain.replaceAll('_', ' ')} / ${receipt.unit}`},
        {key: 'group', label: 'Grouped by', children: receipt.dimensions.map(label).join(', ') || 'One overall total'},
        {key: 'filters', label: 'Filters', children: receipt.filters.map((filter) => `${label(filter.dimension)}: ${filter.values.join(', ')}`).join('; ') || 'No additional filters'},
        {key: 'period', label: 'Period', children: receipt.timeRange ? <><FormattedValue value={receipt.timeRange.from} format="date"/> – <FormattedValue value={receipt.timeRange.to} format="date"/></> : 'Complete observed dataset'},
        {key: 'order', label: 'Ordering', children: receipt.orderBy ? `${receipt.orderBy.direction === 'desc' ? 'Highest' : 'Lowest'} ${receipt.orderBy.field === 'metric' ? 'metric values' : label(receipt.orderBy.field)} first${receipt.limit ? ` · ${receipt.limit} groups` : ''}` : 'Catalog grouping order'},
        {key: 'rows', label: 'Rows shown', children: `${receipt.rowCount}${receipt.truncated ? ' (truncated)' : ''}`}
    ]}/>
    <Typography.Paragraph type="secondary">{receipt.warnings.join(' ')}</Typography.Paragraph>
    <details className="technical-provenance"><summary>Technical provenance</summary>
        <Descriptions size="small" column={1} items={[
            {key: 'formula', label: 'Metric formula', children: receipt.formula},
            {key: 'plan', label: 'Plan ID', children: receipt.planId}, {key: 'result', label: 'Result ID', children: receipt.resultId},
            {key: 'parent', label: 'Parent result', children: receipt.parentResultId ?? 'Initial result'},
            {key: 'ph', label: 'Plan hash', children: receipt.planHash}, {key: 'qh', label: 'Query hash', children: receipt.queryHash},
            {key: 'rh', label: 'Result hash', children: receipt.resultHash}, {key: 'seed', label: 'Seed fingerprint', children: receipt.fixtureFingerprint},
            {key: 'before', label: 'Data revision before', children: receipt.datasetRevisionBefore},
            {key: 'after', label: 'Data revision after', children: receipt.datasetRevisionAfter}
        ]}/>
    </details>
</>;
