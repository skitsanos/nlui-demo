import {ArrowRight} from '@phosphor-icons/react';
import {Alert, Button, Card, Form, Input, InputNumber, Select, Tag, Typography} from 'antd';
import {useEffect, useState, useSyncExternalStore} from 'react';
import type {FormInputValues} from '../../nlui/formValues.ts';
import type {FormBlock} from '../../nlui/types.ts';
import type {ContinueInteraction} from '../confirmationController.ts';
import {FormSubmissionController, type FormSubmissionState} from '../formSubmission.ts';

interface Props {block: FormBlock; disabled?: boolean; onInteraction: ContinueInteraction}

export const DynamicForm = (props: Props) => <FormInstance key={props.block.interactionId} {...props}/>;

const FormInstance = ({block, disabled, onInteraction}: Props) =>
{
    const [controller] = useState(() => new FormSubmissionController(block));
    const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
    useEffect(() => () => controller.cancelPending(), [controller]);
    return <DynamicFormView block={block} state={state} disabled={disabled}
        onSubmit={(values) => controller.submit(values, onInteraction)}/>;
};

export const DynamicFormView = ({block, state, disabled, onSubmit}: {
    block: FormBlock; state: FormSubmissionState; disabled?: boolean;
    onSubmit: (values: FormInputValues) => Promise<void>;
}) =>
{
    const submitting = state === 'submitting';
    const submitted = state === 'submitted';
    const locked = disabled || submitting || submitted;
    return <Card className="nlui-card nlui-form" title={block.title} aria-busy={submitting}
        extra={<Tag color={submitted ? 'success' : 'purple'}>{submitted ? 'Submitted' : submitting ? 'Submitting' : 'Interactive'}</Tag>}>
        {block.description && <Typography.Paragraph type="secondary">{block.description}</Typography.Paragraph>}
        {state === 'error' && <Alert type="error" showIcon className="form-submit-error" title="Response interrupted"
            description="Your entries are kept. Review them and try submitting again."/>}
        <Form name={block.id} layout="vertical" initialValues={block.initialValues}
            onFinish={(values) => {if (!locked) return onSubmit(values);}} disabled={locked}>
            {block.fields.map((field) => <Form.Item key={field.name} name={field.name} label={field.label} extra={field.help}
                rules={field.required ? [{required: true, message: `${field.label} is required`}] : undefined}>
                {field.input === 'textarea' ? <Input.TextArea rows={3} maxLength={field.maxLength}/>
                    : field.input === 'number' ? <InputNumber min={field.min} max={field.max} style={{width: '100%'}}/>
                        : field.input === 'select' ? <Select options={field.options}/>
                            : <Input type={field.input === 'date' ? 'date' : 'text'} placeholder={'placeholder' in field ? field.placeholder : undefined}/>}
            </Form.Item>)}
            <Button type="primary" htmlType="submit" icon={<ArrowRight size={16}/>} iconPlacement="end"
                loading={submitting} disabled={locked}>{submitted ? 'Submitted' : block.submitLabel}</Button>
        </Form>
    </Card>;
};
