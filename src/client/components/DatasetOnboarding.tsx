import {Alert, Button, Card, Table, Typography} from 'antd';
import {useState} from 'react';
import type {DatasetPreview} from '../../onboarding/preview.ts';

export const DatasetOnboarding = () =>
{
    const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
    const [preview, setPreview] = useState<DatasetPreview>(); const [error, setError] = useState('');
    return <section aria-label="Dataset onboarding experiment">
        <Button size="small" onClick={() => setOpen(!open)} aria-expanded={open}>Inspect a dataset</Button>
        {open && <Card size="small" title="CSV preview — never activated automatically" className="dataset-preview">
            <Typography.Paragraph>Use exactly these columns: month,region,revenue_eur,order_count. Up to 1,000 unique month/region rows; 256 KiB maximum. Regions: Central, East, North, South, West.</Typography.Paragraph>
            <label>Choose CSV for inspection <input aria-label="Choose CSV for inspection" type="file" accept=".csv,text/csv" disabled={busy}
                onChange={async (event) =>
                {
                    const file = event.target.files?.[0]; if (!file) return;
                    setBusy(true); setError(''); setPreview(undefined);
                    try
                    {
                        const body = new FormData(); body.append('file', file);
                        const response = await fetch('/api/datasets/preview', {method: 'POST', body});
                        if (!response.ok) throw new Error('The CSV does not match the approved template or the preview limit was reached. No data was activated.');
                        setPreview(await response.json() as DatasetPreview);
                    }
                    catch (error) {setError(error instanceof Error ? error.message : 'Preview unavailable.');}
                    finally {setBusy(false);}
                }}/></label>
            {busy && <Typography.Paragraph role="status">Inspecting template and values…</Typography.Paragraph>}
            {error && <Alert type="error" title="Inspection failed" description={error}/>}
            {preview && <>
                <Alert type="info" title={`${preview.rowCount} validated rows · Quarantined`} description={preview.warnings.join(' ')}/>
                <Table size="small" rowKey={(row) => `${row.month}:${row.region}`} dataSource={preview.rows} pagination={false} scroll={{x: 'max-content'}} columns={[
                    {title: 'Month', dataIndex: 'month'}, {title: 'Region', dataIndex: 'region'},
                    {title: 'Revenue (EUR)', dataIndex: 'revenue_eur'}, {title: 'Orders', dataIndex: 'order_count'}]}/>
            </>}
        </Card>}
    </section>;
};
