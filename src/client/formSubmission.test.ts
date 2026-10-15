import {describe, expect, test} from 'bun:test';
import type {ChatInput, FormBlock} from '../nlui/types.ts';
import {FormSubmissionController} from './formSubmission.ts';

const form: FormBlock = {id: 'form-block', type: 'form', interactionId: 'form-one', title: 'Product preferences',
    submitLabel: 'Find products', fields: [{name: 'purpose', label: 'Purpose', input: 'text', required: true},
        {name: 'budget', label: 'Budget', input: 'number', min: 0}]};

describe('form submission lifecycle', () =>
{
    test('submits a canonical typed result, stops loading on success and locks against replay', async () =>
    {
        const controller = new FormSubmissionController(form);
        const phases: string[] = [];
        const stop = controller.subscribe(() => phases.push(controller.getSnapshot()));
        let calls = 0;
        await controller.submit({purpose: 'Design', budget: null}, async (input, text) =>
        {
            calls += 1;
            expect(input).toEqual({type: 'ui_result', interactionId: form.interactionId, values: {purpose: 'Design'}});
            expect(text).toBe('Submitted Product preferences');
            return true;
        });
        await controller.submit({purpose: 'Another attempt'}, async () => {calls += 1; return true;});
        expect(controller.getSnapshot()).toBe('submitted');
        expect(phases).toEqual(['submitting', 'submitted']);
        expect(calls).toBe(1);
        stop();
    });

    test.each(['false', 'throw'])('a %s continuation restores an editable retry using current values', async (failure) =>
    {
        const controller = new FormSubmissionController(form);
        const inputs: ChatInput[] = [];
        await controller.submit({purpose: 'Design', budget: 2000}, async (input) =>
        {inputs.push(input); if (failure === 'throw') throw new Error('/private/provider-diagnostic'); return false;});
        expect(controller.getSnapshot()).toBe('error');
        await controller.submit({purpose: 'Travel', budget: null}, async (input) => {inputs.push(input); return true;});
        expect(controller.getSnapshot()).toBe('submitted');
        expect(inputs[1]).toEqual({type: 'ui_result', interactionId: form.interactionId, values: {purpose: 'Travel'}});
    });

    test('prevents same-tick and in-flight duplicate submissions independently of React rendering', async () =>
    {
        let resolve: (value: boolean) => void;
        let calls = 0;
        const controller = new FormSubmissionController(form);
        const callback = () => {calls += 1; return new Promise<boolean>((done) => {resolve = done;});};
        const pending = controller.submit({purpose: 'Design'}, callback);
        await controller.submit({purpose: 'Design'}, callback);
        expect(controller.getSnapshot()).toBe('submitting');
        expect(calls).toBe(1);
        resolve!(true);
        await pending;
        expect(controller.getSnapshot()).toBe('submitted');
    });

    test('keeps zero values, required nulls and tampered fields visible to server validation', async () =>
    {
        const controller = new FormSubmissionController({...form, fields: [...form.fields,
            {name: 'count', label: 'Count', input: 'number', required: true}]});
        await controller.submit({purpose: 'Design', budget: 0, count: null, extra: null}, async (input) =>
        {
            expect(input).toMatchObject({values: {purpose: 'Design', budget: 0, count: null, extra: null}});
            return false;
        });
        expect(controller.getSnapshot()).toBe('error');
    });

    test('unmount/reset cannot let an abandoned completion overwrite a newer retry', async () =>
    {
        let resolve: (value: boolean) => void;
        const controller = new FormSubmissionController(form);
        const abandoned = controller.submit({purpose: 'Design'}, () => new Promise((done) => {resolve = done;}));
        controller.cancelPending();
        expect(controller.getSnapshot()).toBe('error');
        await controller.submit({purpose: 'Travel'}, async () => true);
        resolve!(false);
        await abandoned;
        expect(controller.getSnapshot()).toBe('submitted');
    });

    test('idle StrictMode cleanup and unsubscribing cannot fabricate an error', () =>
    {
        const controller = new FormSubmissionController(form);
        let changes = 0;
        const stop = controller.subscribe(() => {changes += 1;});
        controller.cancelPending();
        stop();
        controller.cancelPending();
        expect(controller.getSnapshot()).toBe('idle');
        expect(changes).toBe(0);
    });
});
