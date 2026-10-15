import {CheckCircle, FileText} from '@phosphor-icons/react';
import {
    Button,
    Card,
    Checkbox,
    Radio,
    Result,
    Space,
    Tag,
    Typography
} from 'antd';
import {useRef, useState} from 'react';
import type {ChatInput, ChoicesBlock, NluiBlock} from '../../nlui/types.ts';
import type {ControlState} from '../conversationReplay.ts';
import {AnalysisControls, type AnalysisSubmission} from './AnalysisControls.tsx';
import {Confirmation} from './Confirmation.tsx';
import {DataTable} from './DataTable.tsx';
import {DynamicForm} from './DynamicForm.tsx';
import {MiniChart} from './MiniChart.tsx';
import {ProductFacts} from './ProductFacts.tsx';
import {StatisticsBlock} from './StatisticsBlock.tsx';

interface Props
{
    blocks: NluiBlock[];
    conversationId: string;
    disabled?: boolean;
    states?: Record<string, ControlState>;
    now?: number;
    onAnalyze?: (input: AnalysisSubmission) => Promise<boolean>;
    onInteraction: (input: ChatInput, displayText: string) => Promise<boolean>;
}

const ChoiceInput = ({block, disabled, onInteraction}: Pick<Props, 'disabled' | 'onInteraction'> & {block: ChoicesBlock}) =>
{
    const [selection, setSelection] = useState<string | string[]>(block.multiple ? [] : '');
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [failed, setFailed] = useState(false);
    const pending = useRef(false);
    const locked = disabled || submitted || submitting;
    const values = Array.isArray(selection) ? selection : selection ? [selection] : [];

    const submit = async (): Promise<void> =>
    {
        if (values.length === 0 || locked || pending.current)
        {
            return;
        }
        pending.current = true; setSubmitting(true); setFailed(false);
        const selectedLabels = block.options.filter(({value}) => values.includes(value)).map(({label}) => label);
        try {const completed = await onInteraction(
            {
                type: 'ui_result',
                interactionId: block.interactionId,
                values: {selection: block.multiple ? values : values[0]!}
            },
            `Selected: ${selectedLabels.join(', ')}`
        );
        setSubmitted(completed); setFailed(!completed);}
        catch {setFailed(true);}
        finally {pending.current = false; setSubmitting(false);}
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
        <Card className="nlui-card" title={block.title} aria-busy={submitting} extra={submitted ? <Tag color="success">Submitted</Tag> : submitting ? <Tag>Submitting</Tag> : undefined}>
            {block.description && <Typography.Paragraph type="secondary">{block.description}</Typography.Paragraph>}
            {failed && <Typography.Paragraph role="alert" type="danger">The response did not finish. Your selection is kept; you can try again.</Typography.Paragraph>}
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
            <Button type="primary" className="choice-submit" onClick={submit} loading={submitting} disabled={locked || values.length === 0}>
                Continue
            </Button>
        </Card>
    );
};

export const NluiRenderer = ({blocks, conversationId, disabled: globallyDisabled, onInteraction, states = {}, onAnalyze, now = Date.now()}: Props) => (
    <Space orientation="vertical" size={12} className="nlui-stack">
        {blocks.map((block) =>
        {
            const interactionId = 'interactionId' in block ? block.interactionId : block.id;
            const recorded = states[interactionId];
            const state = (!recorded || recorded === 'available') && block.controlExpiresAt && Date.parse(block.controlExpiresAt) <= now ? 'expired' : recorded;
            const disabled = globallyDisabled || !!state && state !== 'available';
            const render = () => {switch (block.type)
            {
                case 'stats':
                    return <StatisticsBlock key={block.id} block={block}/>;
                case 'chart':
                    return <Card key={block.id} className="nlui-card" title={block.title} extra={<Tag color="geekblue">Dataset result</Tag>}>
                        <MiniChart block={block}/>
                    </Card>;
                case 'table':
                    return <Card key={block.id} className="nlui-card nlui-table-card" title={block.title}>
                        <DataTable block={block} onAnalyze={onAnalyze} disabled={globallyDisabled}/>
                    </Card>;
                case 'choices':
                    return <ChoiceInput key={block.id} block={block} disabled={disabled} onInteraction={onInteraction}/>;
                case 'form':
                    return <DynamicForm key={block.id} block={block} disabled={disabled} onInteraction={onInteraction}/>;
                case 'confirmation':
                    return <Confirmation key={block.id} block={block} conversationId={conversationId} disabled={disabled} onInteraction={onInteraction}/>;
                case 'sources':
                    return <Card key={block.id} className="nlui-card" title={block.title ?? 'Sources'}>
                        <ul className="source-list">{block.items.map((item) => <li key={item.source + item.title}>
                            <FileText size={20} aria-hidden="true"/><div><strong>{item.title}</strong><Typography.Paragraph>{item.excerpt}</Typography.Paragraph><Typography.Text type="secondary">{item.source}</Typography.Text></div>
                        </li>)}</ul>
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
            return null;};
            return <section key={block.id} className="nlui-block">
                {state && state !== 'available' && <Typography.Paragraph role="status" className="control-status"><Tag>{state[0]!.toUpperCase() + state.slice(1)}</Tag>
                    {state === 'completed' ? 'The action is already completed; it will not run again.' : state === 'expired' || state === 'superseded' ? 'Ask for a fresh proposal after checking the current record.' : 'This control is no longer awaiting input.'}
                </Typography.Paragraph>}
                {render()}
                {block.analysis && onAnalyze && <AnalysisControls receipt={block.analysis} onAnalyze={onAnalyze} disabled={globallyDisabled}/>}
            </section>;
        })}
    </Space>
);
