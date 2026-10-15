import {describe, expect, test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import type {ConfirmationBlock} from '../../nlui/types.ts';
import type {ConfirmationState} from '../confirmationController.ts';
import {ConfirmationView} from './Confirmation.tsx';

const block: ConfirmationBlock = {id: 'confirmation-test', type: 'confirmation', actionId: 'action-one',
    title: 'Cancel order ORD-1176', description: 'Review this proposal before confirming.', confirmLabel: 'Cancel order',
    cancelLabel: 'Keep order', severity: 'danger', details: [{label: 'Order', value: 'ORD-1176'}]};
const render = (state: ConfirmationState, disabled = false) => renderToStaticMarkup(<ConfirmationView
    block={block} state={state} disabled={disabled}
    onConfirm={async () => undefined} onReject={async () => undefined} onContinue={async () => undefined}/>);

describe('confirmation presentation', () =>
{
    test('ready confirmations retain the proposal and both explicit choices', () =>
    {
        const html = render({phase: 'ready', continuing: false});
        expect(html).toContain('ORD-1176');
        expect(html).toContain('Cancel order');
        expect(html).toContain('Keep order');
        expect(html).not.toContain('Action outcome not confirmed');
    });

    test('uncertainty keeps the original details, a usable retry and no misleading cancellation', () =>
    {
        const html = render({phase: 'uncertain', continuing: false, retryable: true});
        expect(html).toContain('Action outcome not confirmed');
        expect(html).toContain('may have completed');
        expect(html).toContain('Check result / retry');
        expect(html).toContain('recorded result');
        expect(html).toContain('ORD-1176');
        expect(html).not.toContain('Keep order');
        expect(html).not.toContain('No changes were made');
        expect(html).not.toContain('disabled=""');
    });

    test('unverifiable outcomes remain warnings and explain the manual verification boundary', () =>
    {
        const html = render({phase: 'uncertain', continuing: false, retryable: false});
        expect(html).toContain('Check the order');
        expect(html).toContain('Do not assume that nothing changed');
        expect(html).toContain('disabled=""');
        expect(html).not.toContain('Action not completed');
    });

    test('definite rejections are not presented as uncertain or offered a retry', () =>
    {
        const html = render({phase: 'rejected', continuing: false, message: 'The requested action has expired'});
        expect(html).toContain('Action not completed');
        expect(html).toContain('has expired');
        expect(html).not.toContain('Check result / retry');
        expect(html).not.toContain('Keep order');
    });

    test('submitting disables actions and exposes busy state without a cancel race', () =>
    {
        const html = render({phase: 'submitting', continuing: false});
        expect(html).toContain('aria-busy="true"');
        expect(html).toContain('disabled=""');
        expect(html).not.toContain('Keep order');
    });

    test('recovered success with failed continuation offers chat only, never another action request', () =>
    {
        const html = render({phase: 'completed', recovered: true, continuing: false,
            result: {id: 'result', type: 'result', status: 'success', message: 'Order ORD-1176 cancelled'},
            continuation: {input: {type: 'user_text', text: 'fixture'}, displayText: 'fixture'}});
        expect(html).toContain('Action result recovered');
        expect(html).toContain('Order ORD-1176 cancelled');
        expect(html).toContain('Continue chat');
        expect(html).toContain('will not repeat the action');
        expect(html).not.toContain('Check result / retry');
    });

    test('global chat activity also disables retry controls', () =>
    {
        expect(render({phase: 'uncertain', continuing: false, retryable: true}, true)).toContain('disabled=""');
    });
});
