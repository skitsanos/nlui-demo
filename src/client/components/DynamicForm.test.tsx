import {describe, expect, test} from 'bun:test';
import {Children, isValidElement, type ReactElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {FormInputValues} from '../../nlui/formValues.ts';
import type {FormBlock} from '../../nlui/types.ts';
import type {FormSubmissionState} from '../formSubmission.ts';
import {DynamicFormView} from './DynamicForm.tsx';

const block: FormBlock = {id: 'preferences-form', type: 'form', interactionId: 'preferences-one', title: 'Product preferences',
    submitLabel: 'Find products', initialValues: {purpose: 'Design', budget: 1500},
    fields: [{name: 'purpose', label: 'Primary use', input: 'text', required: true},
        {name: 'budget', label: 'Maximum price', input: 'number', min: 1}]};
const view = (state: FormSubmissionState, disabled = false, onSubmit = async (_values: FormInputValues) => undefined) =>
    DynamicFormView({block, state, disabled, onSubmit});

describe('form submission presentation', () =>
{
    test('success is visibly submitted and disabled without a perpetual spinner', () =>
    {
        const html = renderToStaticMarkup(view('submitted'));
        expect(html).toContain('Submitted');
        expect(html).toContain('aria-busy="false"');
        expect(html).toContain('disabled=""');
        expect(html).not.toContain('ant-btn-loading');
        expect(html).toContain('value="Design"');
        expect(html).toContain('value="1500"');
    });

    test('only pending submission shows a busy indicator', () =>
    {
        const html = renderToStaticMarkup(view('submitting'));
        expect(html).toContain('aria-busy="true"');
        expect(html).toContain('ant-btn-loading');
        expect(html).toContain('disabled=""');
    });

    test('failure preserves input values and enables review/retry without private diagnostics', () =>
    {
        const html = renderToStaticMarkup(view('error'));
        expect(html).toContain('Response interrupted');
        expect(html).toContain('Your entries are kept');
        expect(html).toContain('value="Design"');
        expect(html).not.toContain('disabled=""');
        expect(html).not.toContain('ant-btn-loading');
    });

    test.each(['submitting', 'submitted', 'idle'] as const)('onFinish cannot bypass the locked %s form', async (state) =>
    {
        let calls = 0;
        const card = view(state, state === 'idle', async () => {calls += 1;});
        const form = Children.toArray(card.props.children).find((child) => isValidElement<{name?: string}>(child) && child.props.name === block.id) as ReactElement<{
            onFinish: (values: FormInputValues) => Promise<void> | undefined;
        }>;
        await form.props.onFinish({purpose: 'Design'});
        expect(calls).toBe(0);
    });

    test('required labels, initial values and the optional budget control remain present', () =>
    {
        const html = renderToStaticMarkup(view('idle'));
        expect(html).toContain('Primary use');
        expect(html).toContain('Maximum price');
        expect(html).toContain('aria-required="true"');
        expect(html).toContain('Find products');
    });
});
