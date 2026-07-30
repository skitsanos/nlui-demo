import {ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle, FileText} from '@phosphor-icons/react';
import {
    Alert,
    Button,
    Card,
    Checkbox,
    Descriptions,
    Form,
    Input,
    InputNumber,
    List,
    Popconfirm,
    Radio,
    Result,
    Select,
    Space,
    Statistic,
    Table,
    Tag,
    Typography
} from 'antd';
import {useState} from 'react';
import type {ChatInput, ChoicesBlock, FormBlock, NluiBlock, ResultBlock, TableBlock} from '../../nlui/types.ts';
import {MiniChart} from './MiniChart.tsx';

interface Props
{
    blocks: NluiBlock[];
    disabled?: boolean;
    onInteraction: (input: ChatInput, displayText: string) => void;
}

const currency = new Intl.NumberFormat('en', {style: 'currency', currency: 'EUR'});
const number = new Intl.NumberFormat('en', {maximumFractionDigits: 2});

const formatCell = (value: unknown, format?: TableBlock['columns'][number]['format']) =>
{
    if (value === null || value === undefined)
    {
        return '—';
    }
    if (format === 'currency' && typeof value === 'number')
    {
        return currency.format(value);
    }
    if (format === 'number' && typeof value === 'number')
    {
        return number.format(value);
    }
    if (format === 'status')
    {
        const text = String(value);
        const color = /complete|delivered|success/i.test(text) ? 'green'
            : /delay|cancel|failed|return/i.test(text) ? 'red'
                : 'blue';
        return <Tag color={color}>{text}</Tag>;
    }
    return String(value);
};

const DynamicForm = ({block, disabled, onInteraction}: Omit<Props, 'blocks'> & {block: FormBlock}) =>
{
    const submit = (values: Record<string, string | number>): void =>
    {
        onInteraction(
            {type: 'ui_result', interactionId: block.interactionId, values},
            `Submitted ${block.title ?? 'the requested details'}`
        );
    };

    return (
        <Card className="nlui-card" title={block.title} extra={<Tag color="purple">Interactive</Tag>}>
            {block.description && <Typography.Paragraph type="secondary">{block.description}</Typography.Paragraph>}
            <Form name={block.id} layout="vertical" initialValues={block.initialValues} onFinish={submit} disabled={disabled}>
                {block.fields.map((field) =>
                    <Form.Item
                        key={field.name}
                        name={field.name}
                        label={field.label}
                        extra={field.help}
                        rules={field.required ? [{required: true, message: `${field.label} is required`}] : undefined}
                    >
                        {field.input === 'textarea' ? <Input.TextArea rows={3} maxLength={field.maxLength}/>
                            : field.input === 'number' ? <InputNumber min={field.min} max={field.max} style={{width: '100%'}}/>
                                : field.input === 'select' ? <Select options={field.options}/>
                                    : <Input type={field.input === 'date' ? 'date' : 'text'} placeholder={'placeholder' in field ? field.placeholder : undefined}/>}
                    </Form.Item>
                )}
                <Button type="primary" htmlType="submit" icon={<ArrowRight size={16}/>} iconPosition="end">
                    {block.submitLabel}
                </Button>
            </Form>
        </Card>
    );
};

const ChoiceInput = ({block, disabled, onInteraction}: Omit<Props, 'blocks'> & {block: ChoicesBlock}) =>
{
    const [selection, setSelection] = useState<string | string[]>(block.multiple ? [] : '');
    const [submitted, setSubmitted] = useState(false);
    const locked = disabled || submitted;
    const values = Array.isArray(selection) ? selection : selection ? [selection] : [];

    const submit = (): void =>
    {
        if (values.length === 0)
        {
            return;
        }
        setSubmitted(true);
        const selectedLabels = block.options.filter(({value}) => values.includes(value)).map(({label}) => label);
        onInteraction(
            {
                type: 'ui_result',
                interactionId: block.interactionId,
                values: {selection: block.multiple ? values : values[0]!}
            },
            `Selected: ${selectedLabels.join(', ')}`
        );
    };

    const cards = block.options.map((option) =>
        block.multiple ? <Checkbox key={option.value} value={option.value} className="choice-card">
            <strong>{option.label}</strong>
            {option.description && <span>{option.description}</span>}
            {option.meta && <Tag>{option.meta}</Tag>}
        </Checkbox> : <Radio key={option.value} value={option.value} className="choice-card">
            <strong>{option.label}</strong>
            {option.description && <span>{option.description}</span>}
            {option.meta && <Tag>{option.meta}</Tag>}
        </Radio>
    );

    return (
        <Card className="nlui-card" title={block.title} extra={submitted ? <Tag color="success">Submitted</Tag> : undefined}>
            {block.description && <Typography.Paragraph type="secondary">{block.description}</Typography.Paragraph>}
            {block.multiple ? <Checkbox.Group
                disabled={locked}
                className="choice-grid"
                value={Array.isArray(selection) ? selection : []}
                onChange={(next) => setSelection(next.map(String))}
            >{cards}</Checkbox.Group> : <Radio.Group
                disabled={locked}
                className="choice-grid"
                value={selection}
                onChange={(event) => setSelection(String(event.target.value))}
            >{cards}</Radio.Group>}
            <Button type="primary" className="choice-submit" onClick={submit} disabled={locked || values.length === 0}>
                Continue
            </Button>
        </Card>
    );
};

const Confirmation = ({
    block,
    disabled,
    onInteraction
}: Omit<Props, 'blocks'> & {block: Extract<NluiBlock, {type: 'confirmation'}>}) =>
{
    const [result, setResult] = useState<ResultBlock>();
    const [loading, setLoading] = useState(false);

    const confirm = async (): Promise<void> =>
    {
        setLoading(true);
        try
        {
            const response = await fetch('/api/actions', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({actionId: block.actionId})
            });
            const payload = await response.json() as {block?: ResultBlock; message?: string};
            if (!response.ok || !payload.block)
            {
                throw new Error(payload.message ?? 'The action could not be completed');
            }
            setResult(payload.block);
            onInteraction({
                type: 'ui_result',
                interactionId: block.id,
                values: {outcome: 'confirmed', action_id: block.actionId, message: payload.block.message}
            }, payload.block.message);
        }
        catch (error)
        {
            setResult({
                id: `${block.id}-error`,
                type: 'result',
                status: 'error',
                message: error instanceof Error ? error.message : 'The action failed'
            });
        }
        finally
        {
            setLoading(false);
        }
    };

    const reject = (): void =>
    {
        const rejected: ResultBlock = {
            id: `${block.id}-cancelled`,
            type: 'result',
            status: 'info',
            title: 'Action cancelled',
            message: 'No changes were made.'
        };
        setResult(rejected);
        onInteraction({
            type: 'ui_result',
            interactionId: block.id,
            values: {outcome: 'rejected', action_id: block.actionId}
        }, 'Cancelled the proposed action');
    };

    if (result)
    {
        return <Alert type={result.status === 'error' ? 'error' : 'success'} showIcon message={result.title ?? 'Action result'} description={result.message}/>;
    }

    return (
        <Card className="nlui-card nlui-confirm" title={block.title}>
            {block.description && <Typography.Paragraph>{block.description}</Typography.Paragraph>}
            <Descriptions size="small" column={1} items={block.details.map((item, index) => ({key: index, ...item}))}/>
            <Space className="confirm-actions">
                <Popconfirm title="Confirm this demo action?" onConfirm={confirm} okText="Confirm">
                    <Button danger={block.severity === 'danger'} type="primary" loading={loading} disabled={disabled}>
                        {block.confirmLabel}
                    </Button>
                </Popconfirm>
                {block.cancelLabel && <Button disabled={disabled} onClick={reject}>{block.cancelLabel}</Button>}
            </Space>
        </Card>
    );
};

export const NluiRenderer = ({blocks, disabled, onInteraction}: Props) => (
    <Space orientation="vertical" size={12} className="nlui-stack">
        {blocks.map((block) =>
        {
            switch (block.type)
            {
                case 'stats':
                    return <div className="stat-grid" key={block.id}>{block.items.map((item) =>
                        <Card size="small" key={item.label} className="stat-card">
                            <Statistic title={item.label} value={item.value} suffix={item.suffix}/>
                            {item.trend && <span className={`trend trend-${item.trend}`}>
                                {item.trend === 'up' ? <ArrowUpRight/> : item.trend === 'down' ? <ArrowDownRight/> : <ArrowRight/>}
                            </span>}
                        </Card>
                    )}</div>;
                case 'chart':
                    return <Card key={block.id} className="nlui-card" title={block.title} extra={<Tag color="geekblue">Dataset result</Tag>}>
                        <MiniChart block={block}/>
                    </Card>;
                case 'table':
                    return <Card key={block.id} className="nlui-card" title={block.title}>
                        <Table
                            rowKey={(row) => String(row[block.rowKey])}
                            dataSource={block.rows}
                            columns={block.columns.map((column) => ({
                                title: column.label,
                                dataIndex: column.key,
                                key: column.key,
                                render: (value: unknown) => formatCell(value, column.format)
                            }))}
                            size="small"
                            scroll={{x: true}}
                            pagination={block.rows.length > 8 ? {pageSize: 8, size: 'small'} : false}
                        />
                    </Card>;
                case 'choices':
                    return <ChoiceInput key={block.id} block={block} disabled={disabled} onInteraction={onInteraction}/>;
                case 'form':
                    return <DynamicForm key={block.id} block={block} disabled={disabled} onInteraction={onInteraction}/>;
                case 'confirmation':
                    return <Confirmation key={block.id} block={block} disabled={disabled} onInteraction={onInteraction}/>;
                case 'sources':
                    return <Card key={block.id} className="nlui-card" title={block.title ?? 'Sources'}>
                        <List dataSource={block.items} renderItem={(item) => <List.Item>
                            <List.Item.Meta avatar={<FileText size={20}/>} title={item.title} description={<>{item.excerpt}<br/><Typography.Text type="secondary">{item.source}</Typography.Text></>}/>
                        </List.Item>}/>
                    </Card>;
                case 'result':
                    return <Result
                        key={block.id}
                        className="inline-result"
                        status={block.status}
                        icon={block.status === 'success' ? <CheckCircle/> : undefined}
                        title={block.title}
                        subTitle={block.message}
                    />;
            }
            return null;
        })}
    </Space>
);
