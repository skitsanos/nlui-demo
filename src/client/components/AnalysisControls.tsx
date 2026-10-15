import {Button, Form, Input, InputNumber, Select, Space, Typography} from 'antd';
import {useState} from 'react';
import type {ArtifactReceipt, PlanDelta} from '../../analysis/artifacts.ts';
import {SEMANTIC_DIMENSION_IDS, SEMANTIC_DIMENSIONS, SEMANTIC_METRIC_IDS, SEMANTIC_METRICS} from '../../data/semantic/catalog.ts';
import {semanticFilterSchema} from '../../data/semantic/schema.ts';
import {DATASET_REFERENCE_DATE} from '../../shared/dataset.ts';
import {ArtifactProvenance} from './ArtifactProvenance.tsx';

export type AnalysisSubmission = {plan?: unknown; parentResultId?: string; delta?: PlanDelta};
export interface AnalysisProps {disabled?: boolean; onAnalyze: (input: AnalysisSubmission) => Promise<boolean>; receipt?: ArtifactReceipt}

export const AnalysisControls = ({disabled, onAnalyze, receipt}: AnalysisProps) =>
{
    const [open, setOpen] = useState(false);
    const [metric, setMetric] = useState(receipt?.metric ?? 'eligible_revenue_eur');
    const definition = SEMANTIC_METRICS[metric as typeof SEMANTIC_METRIC_IDS[number]];
    const [error, setError] = useState('');
    return <section className="analysis-controls" aria-label={receipt ? 'Result provenance and refinement' : 'Dataset exploration'}>
        <Button size="small" onClick={() => setOpen(!open)} aria-expanded={open} disabled={disabled}>
            {receipt ? 'Scope & refine' : 'Explore dataset'}
        </Button>
        {open && <div className="analysis-panel">
            {receipt && <>
                <ArtifactProvenance receipt={receipt}/>
            </>}
            <Form name={`analysis-${receipt?.resultId ?? 'new'}`} layout="vertical" disabled={disabled} initialValues={{metric, group: receipt?.dimensions ?? [],
                from: receipt?.timeRange?.from, to: receipt?.timeRange?.to, region: receipt?.filters.find((f) => f.dimension === 'region')?.values[0],
                top: receipt?.limit, direction: receipt?.orderBy?.direction ?? 'desc'}}
                onFinish={async (values) =>
                {
                    const filters = [...receipt?.filters.filter((filter) => filter.dimension !== 'region').map((filter) => semanticFilterSchema.parse(filter)) ?? [],
                        ...values.region ? [semanticFilterSchema.parse({dimension: 'region', values: [String(values.region)]})] : []];
                    const delta: PlanDelta = {metric: values.metric, dimensions: values.group ?? [], filters,
                        timeRange: definition.timeScope.kind !== 'lifetime' && (values.from || values.to) ? {from: String(values.from ?? ''), to: String(values.to ?? '')} : null,
                        orderBy: values.top && values.group?.length ? {field: 'metric', direction: values.direction} : null,
                        limit: values.top && values.group?.length ? Number(values.top) : null};
                    const plan = {metric: delta.metric, dimensions: delta.dimensions, filters,
                        ...delta.timeRange && {timeRange: delta.timeRange}, ...delta.orderBy && {orderBy: delta.orderBy}, ...delta.limit && {limit: delta.limit}};
                    const okay = await onAnalyze(receipt ? {parentResultId: receipt.resultId, delta} : {plan});
                    setError(okay ? '' : 'This combination could not be applied. Check the definition, dimensions and complete date range.');
                    if (okay) setOpen(false);
                }}>
                <Form.Item name="metric" label="Metric"><Select onChange={setMetric} options={SEMANTIC_METRIC_IDS.map((id) => ({value: id, label: SEMANTIC_METRICS[id].label}))}/></Form.Item>
                <Typography.Paragraph type="secondary">{definition.description}</Typography.Paragraph>
                <Form.Item name="group" label="Group by"><Select mode="multiple" maxCount={3} allowClear options={SEMANTIC_DIMENSION_IDS.filter((id) => definition.compatibleDimensions.includes(id)).map((id) => ({value: id, label: SEMANTIC_DIMENSIONS[id].label}))}/></Form.Item>
                <Space wrap>
                    <Form.Item name="from" label="Period start (UTC)"><Input type="date" max={DATASET_REFERENCE_DATE.slice(0, 10)} disabled={definition.timeScope.kind === 'lifetime'}/></Form.Item>
                    <Form.Item name="to" label="Period end (UTC)"><Input type="date" max={DATASET_REFERENCE_DATE.slice(0, 10)} disabled={definition.timeScope.kind === 'lifetime'}/></Form.Item>
                </Space>
                <Form.Item name="region" label="Region"><Select allowClear options={['Central', 'East', 'North', 'South', 'West'].map((value) => ({value, label: value}))}/></Form.Item>
                <Space wrap>
                    <Form.Item name="top" label="Top / bottom N (grouped only)"><InputNumber min={1} max={100}/></Form.Item>
                    <Form.Item name="direction" label="Ranking"><Select options={[{value: 'desc', label: 'Highest first'}, {value: 'asc', label: 'Lowest first'}]}/></Form.Item>
                </Space>
                {error && <Typography.Paragraph role="alert" type="danger">{error}</Typography.Paragraph>}
                <Button htmlType="submit" type="primary" disabled={disabled}>{receipt ? 'Apply refinement' : 'Analyze'}</Button>
            </Form>
        </div>}
    </section>;
};
