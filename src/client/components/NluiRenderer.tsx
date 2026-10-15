import {CheckCircle, FileText} from '@phosphor-icons/react';
import {
    Button,
    Card,
    Checkbox,
    List,
    Radio,
    Result,
    Space,
    Table,
    Tag,
    Typography
} from 'antd';
import {useState} from 'react';
import type {ChatInput, ChoicesBlock, NluiBlock, TableBlock} from '../../nlui/types.ts';
import {Confirmation} from './Confirmation.tsx';
import {DynamicForm} from './DynamicForm.tsx';
import {FormattedValue} from './FormattedValue.tsx';
import {MiniChart} from './MiniChart.tsx';
import {ProductFacts} from './ProductFacts.tsx';
import {StatisticsBlock} from './StatisticsBlock.tsx';

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
            <ProductFacts sku={option.value} facts={option.facts ?? []}/>
        </Checkbox> : <Radio key={option.value} value={option.value} className="choice-card">
            <strong>{option.label}</strong>
            {option.description && <span>{option.description}</span>}
            {option.meta && <Tag>{option.meta}</Tag>}
            <ProductFacts sku={option.value} facts={option.facts ?? []}/>
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

export const NluiRenderer = ({blocks, conversationId, disabled, onInteraction}: Props) => (
    <Space orientation="vertical" size={12} className="nlui-stack">
        {blocks.map((block) =>
        {
            switch (block.type)
            {
                case 'stats':
                    return <StatisticsBlock key={block.id} block={block}/>;
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
