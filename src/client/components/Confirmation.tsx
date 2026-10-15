import {Alert, Button, Card, Descriptions, Popconfirm, Space, Typography} from 'antd';
import {useEffect, useMemo, useSyncExternalStore} from 'react';
import type {ConfirmationBlock} from '../../nlui/types.ts';
import {ConfirmationController, type ConfirmationState, type ContinueInteraction} from '../confirmationController.ts';
import {FormattedValue} from './FormattedValue.tsx';

interface Props
{
    block: ConfirmationBlock;
    conversationId: string;
    disabled?: boolean;
    onInteraction: ContinueInteraction;
}

export const Confirmation = ({block, conversationId, disabled, onInteraction}: Props) =>
{
    const controller = useMemo(() => new ConfirmationController({conversationId, interactionId: block.id, actionId: block.actionId}),
        [conversationId, block.id, block.actionId]);
    const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
    useEffect(() => () => controller.cancelPending(), [controller]);

    return <ConfirmationView block={block} state={state} disabled={disabled}
        onConfirm={() => controller.confirm(onInteraction)} onReject={() => controller.reject(onInteraction)}
        onContinue={() => controller.continueChat(onInteraction)}/>;
};

export const ConfirmationView = ({block, state, disabled, onConfirm, onReject, onContinue}: {
    block: ConfirmationBlock;
    state: ConfirmationState;
    disabled?: boolean;
    onConfirm: () => Promise<void>;
    onReject: () => Promise<void>;
    onContinue: () => Promise<void>;
}) =>
{

    if (state.result)
    {
        return <Space orientation="vertical" size={8} className="nlui-stack" aria-busy={state.continuing}>
            <Alert type={state.phase === 'cancelled' ? 'info' : 'success'} showIcon
                title={state.recovered ? 'Action result recovered' : state.result.title ?? 'Action result'}
                description={state.result.message}/>
            {state.continuation && <>
                <Typography.Text type="secondary">
                    {state.continuing ? 'Continuing the conversation…' : 'The conversation has not continued yet. Continuing chat will not repeat the action.'}
                </Typography.Text>
                <Button loading={state.continuing} disabled={disabled || state.continuing}
                    onClick={() => void onContinue()}>Continue chat</Button>
            </>}
        </Space>;
    }

    const submitting = state.phase === 'submitting';
    const uncertain = state.phase === 'uncertain';
    return <Card className="nlui-card nlui-confirm" title={block.title} aria-busy={submitting}>
        {block.description && <Typography.Paragraph>{block.description}</Typography.Paragraph>}
        <Descriptions size="small" column={1} items={block.details.map((item, index) => ({
            key: index, label: item.label, children: <FormattedValue value={item.value} format={item.format}/>
        }))}/>
        {uncertain && <Alert type="warning" showIcon title="Action outcome not confirmed"
            description={state.retryable
                ? 'The request may have completed. Check result / retry uses the same action: the server returns its recorded result or completes it once if it has not run.'
                : 'The request may have completed, but this confirmation is no longer available to verify. Check the order before asking for a new proposal. Do not assume that nothing changed.'}/>}
        {state.phase === 'rejected' && <Alert type="error" showIcon title="Action not completed" description={state.message}/>}
        <Space className="confirm-actions" wrap>
            {(uncertain || submitting && state.retryable) ? <Button type="primary" loading={submitting}
                disabled={disabled || submitting || !state.retryable}
                onClick={() => void onConfirm()}>Check result / retry</Button>
                : state.phase !== 'rejected' && <Popconfirm title="Confirm this demo action?"
                    onConfirm={() => {if (!disabled) return onConfirm();}} okText="Confirm"
                    disabled={disabled || submitting}>
                    <Button danger={block.severity === 'danger'} type="primary" loading={submitting} disabled={disabled || submitting}>
                        {block.confirmLabel}
                    </Button>
                </Popconfirm>}
            {block.cancelLabel && state.phase === 'ready' && <Button disabled={disabled}
                onClick={() => void onReject()}>{block.cancelLabel}</Button>}
        </Space>
    </Card>;
};
