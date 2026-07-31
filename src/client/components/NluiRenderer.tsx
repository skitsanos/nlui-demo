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
import {FormattedValue} from './FormattedValue.tsx';
import {MiniChart} from './MiniChart.tsx';

interface Props
{
    blocks: NluiBlock[];
    conversationId: string;
    disabled?: boolean;
    onInteraction: (input: ChatInput, displayText: string) => Promise<boolean>;
}

const tableColumnMinWidth = (format: TableBlock['columns'][number]['format']): number =>
{
    switch (format)
    {
        case 'number':
            return 96;
        case 'currency':
            return 128;
        case 'status':
            return 120;
        case 'date':
            return 176;
        default:
            return 160;
    }
};

const DynamicForm = ({block, disabled, onInteraction}: Pick<Props, 'disabled' | 'onInteraction'> & {block: FormBlock}) =>
{
    const [submitted, setSubmitted] = useState(false);
    const submit = async (values: Record<string, string | number>): Promise<void> =>
    {
        setSubmitted(true);
        const completed = await onInteraction(
            {type: 'ui_result', interactionId: block.interactionId, values},
            `Submitted ${block.title ?? 'the requested details'}`
        );
        if (!completed) setSubmitted(false);
    };

    return (
        <Card className="nlui-card" title={block.title} extra={<Tag color="purple">Interactive</Tag>}>
            {block.description && <Typography.Paragraph type="secondary">{block.description}</Typography.Paragraph>}
            <Form name={block.id} layout="vertical" initialValues={block.initialValues} onFinish={submit} disabled={disabled || submitted}>
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
                <Button type="primary" htmlType="submit" icon={<ArrowRight size={16}/>} iconPlacement="end" loading={submitted}>
                    {block.submitLabel}
                </Button>
            </Form>
        </Card>
    );
};

const ChoiceInput = ({block, disabled, onInteraction}: Pick<Props, 'disabled' | 'onInteraction'> & {block: ChoicesBlock}) =>
{
    const [selection, setSelection] = useState<string | string[]>(block.multiple ? [] : '');
    const [submitted, setSubmitted] = useState(false);
    const locked = disabled || submitted;
    const values = Array.isArray(selection) ? selection : selection ? [selection] : [];

    const submit = async (): Promise<void> =>
    {
        if (values.length === 0)
        {
            return;
        }
        setSubmitted(true);
        const selectedLabels = block.options.filter(({value}) => values.includes(value)).map(({label}) => label);
        const completed = await onInteraction(
            {
                type: 'ui_result',
                interactionId: block.interactionId,
                values: {selection: block.multiple ? values : values[0]!}
            },
            `Selected: ${selectedLabels.join(', ')}`
        );
        if (!completed) setSubmitted(false);
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
    conversationId,
    disabled,
    onInteraction
}: Omit<Props, 'blocks'> & {block: Extract<NluiBlock, {type: 'confirmation'}>}) =>
{
    const [result, setResult] = useState<ResultBlock>();
    const [loading, setLoading] = useState(false);
    const [continuing, setContinuing] = useState(false);
    const [pendingContinuation, setPendingContinuation] = useState<{
        input: ChatInput;
        displayText: string;
    }>();

    const continueChat = async (continuation: {input: ChatInput; displayText: string}): Promise<void> =>
    {
        setPendingContinuation(continuation);
        setContinuing(true);
        try
        {
            if (await onInteraction(continuation.input, continuation.displayText))
            {
                setPendingContinuation(undefined);
            }
        }
        finally
        {
            setContinuing(false);
        }
    };

    const confirm = async (): Promise<void> =>
    {
        setLoading(true);
        try
        {
            const response = await fetch('/api/actions', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({conversationId, interactionId: block.id, actionId: block.actionId})
            });
            const payload = await response.json() as {block?: ResultBlock; message?: string};
            if (!response.ok || !payload.block)
            {
                throw new Error(payload.message ?? 'The action could not be completed');
            }
            setResult(payload.block);
            await continueChat({
                input: {
                    type: 'ui_result',
                    interactionId: block.id,
                    values: {outcome: 'confirmed', action_id: block.actionId}
                },
                displayText: payload.block.message
            });
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

    const reject = async (): Promise<void> =>
    {
        const rejected: ResultBlock = {
            id: `${block.id}-cancelled`,
            type: 'result',
            status: 'info',
            title: 'Action cancelled',
            message: 'No changes were made.'
        };
        setResult(rejected);
        await continueChat({
            input: {
                type: 'ui_result',
                interactionId: block.id,
                values: {outcome: 'rejected', action_id: block.actionId}
            },
            displayText: 'Cancelled the proposed action'
        });
    };

    if (result)
    {
        return <Space orientation="vertical" size={8} className="nlui-stack">
            <Alert
                type={result.status === 'error' ? 'error' : result.status === 'info' ? 'info' : 'success'}
                showIcon
                message={result.title ?? 'Action result'}
                description={result.message}
            />
            {pendingContinuation && <Button
                loading={continuing}
                onClick={() => void continueChat(pendingContinuation)}
            >Continue chat</Button>}
        </Space>;
    }

    return (
        <Card className="nlui-card nlui-confirm" title={block.title}>
            {block.description && <Typography.Paragraph>{block.description}</Typography.Paragraph>}
            <Descriptions size="small" column={1} items={block.details.map((item, index) => ({
                key: index,
                label: item.label,
                children: <FormattedValue value={item.value} format={item.format}/>
            }))}/>
            <Space className="confirm-actions">
                <Popconfirm title="Confirm this demo action?" onConfirm={confirm} okText="Confirm">
                    <Button danger={block.severity === 'danger'} type="primary" loading={loading} disabled={disabled}>
                        {block.confirmLabel}
                    </Button>
                </Popconfirm>
                {block.cancelLabel && <Button disabled={disabled} onClick={() => void reject()}>{block.cancelLabel}</Button>}
            </Space>
        </Card>
    );
};

export const NluiRenderer = ({blocks, conversationId, disabled, onInteraction}: Props) => (
    <Space orientation="vertical" size={12} className="nlui-stack">
        {blocks.map((block) =>
        {
            switch (block.type)
            {
                case 'stats':
                    return <div className="stat-grid" key={block.id}>{block.items.map((item) =>
                        <Card
                            size="small"
                            key={item.label}
                            className={`stat-card${item.format === 'date' ? ' stat-card-temporal' : ''}`}
                        >
                            <Statistic
                                title={item.label}
                                value={item.value}
                                suffix={item.suffix}
                                formatter={item.format
                                    ? () => <FormattedValue value={item.value} format={item.format}/>
                                    : undefined}
                            />
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
                    return <Card key={block.id} className="nlui-card nlui-table-card" title={block.title}>
                        <section
                            className="nlui-table-region"
                            aria-label={block.title ?? 'Data table'}
                        >
                            <Table
                                className="nlui-table"
                                rowKey={(row) => String(row[block.rowKey])}
                                dataSource={block.rows}
                                columns={block.columns.map((column) => ({
                                    title: column.label,
                                    dataIndex: column.key,
                                    key: column.key,
                                    minWidth: tableColumnMinWidth(column.format),
                                    align: column.format === 'number' || column.format === 'currency' ? 'right' : 'left',
                                    render: (value: TableBlock['rows'][number][string]) => (
                                        <FormattedValue value={value} format={column.format}/>
                                    )
                                }))}
                                size="small"
                                scroll={{x: 'max-content'}}
                                pagination={block.rows.length > 8 ? {pageSize: 8, size: 'small'} : false}
                            />
                        </section>
                    </Card>;
                case 'choices':
                    return <ChoiceInput key={block.id} block={block} disabled={disabled} onInteraction={onInteraction}/>;
                case 'form':
                    return <DynamicForm key={block.id} block={block} disabled={disabled} onInteraction={onInteraction}/>;
                case 'confirmation':
                    return <Confirmation key={block.id} block={block} conversationId={conversationId} disabled={disabled} onInteraction={onInteraction}/>;
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
