import {describe, expect, test} from 'bun:test';
import {
    InteractionCapabilityError,
    type InteractionCapabilityErrorCode,
    InteractionCapabilityRegistry
} from './interactionCapabilities.ts';
import type {ChoicesBlock, ConfirmationBlock, FormBlock} from './types.ts';

const conversation = 'conversation-primary';

const selectForm = (interactionId = 'select-form'): FormBlock => ({
    id: `block-${interactionId}`,
    type: 'form',
    interactionId,
    title: 'Choose a tier',
    submitLabel: 'Continue',
    fields: [{
        name: 'tier',
        label: 'Customer tier',
        input: 'select',
        required: true,
        options: [
            {label: 'Gold', value: 'gold'},
            {label: 'Silver', value: 'silver'}
        ]
    }]
});

const choices = (interactionId = 'product-choices'): ChoicesBlock => ({
    id: `block-${interactionId}`,
    type: 'choices',
    interactionId,
    options: [
        {label: 'Laptop', value: 'SKU-0001'},
        {label: 'Display', value: 'SKU-0002'}
    ]
});

const confirmation = (interactionId = 'confirmation-1'): ConfirmationBlock => ({
    id: interactionId,
    type: 'confirmation',
    actionId: 'action-1',
    confirmLabel: 'Confirm',
    details: []
});

const completedResult = () => ({
    id: 'result-1',
    type: 'result' as const,
    status: 'success' as const,
    message: 'Action completed'
});

const expectCapabilityError = (operation: () => unknown, code: InteractionCapabilityErrorCode): void =>
{
    try
    {
        operation();
        throw new Error('Expected the capability operation to fail.');
    }
    catch (error)
    {
        expect(error).toBeInstanceOf(InteractionCapabilityError);
        expect((error as InteractionCapabilityError).code).toBe(code);
    }
};

describe('interaction capability registry', () =>
{
    test('rejects an interaction identifier the server never issued', () =>
    {
        const registry = new InteractionCapabilityRegistry();
        expectCapabilityError(() => registry.consume(conversation, 'unknown', {}), 'unknown');
    });

    test('rejects an altered select value without consuming the valid capability', () =>
    {
        const registry = new InteractionCapabilityRegistry();
        registry.issue(conversation, selectForm());

        expectCapabilityError(
            () => registry.consume(conversation, 'select-form', {tier: 'administrator'}),
            'invalid_payload'
        );
        expect(registry.consume(conversation, 'select-form', {tier: 'gold'})).toEqual({tier: 'gold'});
    });

    test('rejects fields that were not present in the issued form', () =>
    {
        const registry = new InteractionCapabilityRegistry();
        registry.issue(conversation, selectForm());

        expectCapabilityError(
            () => registry.consume(conversation, 'select-form', {tier: 'silver', role: 'admin'}),
            'invalid_payload'
        );
    });

    test('issues a selected capability batch atomically', () =>
    {
        const registry = new InteractionCapabilityRegistry();
        registry.issue(conversation, selectForm());

        expect(() => registry.issueMany(conversation, [choices('new-choice'), selectForm()]))
            .toThrow('issued more than once');
        expectCapabilityError(
            () => registry.consume(conversation, 'new-choice', {selection: 'SKU-0001'}),
            'unknown'
        );
        expect(registry.consume(conversation, 'select-form', {tier: 'gold'})).toEqual({tier: 'gold'});
    });

    test('rejects a replay after a valid form result is consumed', () =>
    {
        const registry = new InteractionCapabilityRegistry();
        registry.issue(conversation, selectForm());
        registry.consume(conversation, 'select-form', {tier: 'silver'});

        expectCapabilityError(
            () => registry.consume(conversation, 'select-form', {tier: 'silver'}),
            'consumed'
        );
    });

    test('rejects an expired interaction capability', () =>
    {
        let now = 1_000;
        const registry = new InteractionCapabilityRegistry({ttlMs: 50, now: () => now});
        registry.issue(conversation, selectForm());
        now += 50;

        expectCapabilityError(
            () => registry.consume(conversation, 'select-form', {tier: 'gold'}),
            'expired'
        );
    });

    test('binds an issued choice to its conversation and exact options', () =>
    {
        const registry = new InteractionCapabilityRegistry();
        registry.issue(conversation, choices());

        expectCapabilityError(
            () => registry.consume('conversation-attacker', 'product-choices', {selection: 'SKU-0001'}),
            'conversation_mismatch'
        );
        expectCapabilityError(
            () => registry.consume(conversation, 'product-choices', {selection: 'SKU-9999'}),
            'invalid_payload'
        );
        expect(registry.consume(conversation, 'product-choices', {selection: 'SKU-0001'}))
            .toEqual({selection: 'SKU-0001'});
    });

    test('requires server action completion before accepting a confirmed result', () =>
    {
        const registry = new InteractionCapabilityRegistry();
        registry.issue(conversation, confirmation());

        expectCapabilityError(
            () => registry.consume(conversation, 'confirmation-1', {outcome: 'confirmed', action_id: 'action-1'}),
            'action_not_completed'
        );
        expectCapabilityError(
            () => registry.beginConfirmation('conversation-attacker', 'confirmation-1', 'action-1'),
            'conversation_mismatch'
        );

        registry.beginConfirmation(conversation, 'confirmation-1', 'action-1');
        registry.completeConfirmation(conversation, 'confirmation-1', 'action-1', completedResult());
        expectCapabilityError(
            () => registry.beginConfirmation('conversation-attacker', 'confirmation-1', 'action-1'),
            'conversation_mismatch'
        );
        expect(registry.consume(conversation, 'confirmation-1', {
            outcome: 'confirmed',
            action_id: 'action-1'
        })).toEqual({
            outcome: 'confirmed',
            action_id: 'action-1',
            action_status: 'success',
            message: 'Action completed'
        });
    });

    test('releases a failed action reservation for one safe retry', () =>
    {
        const registry = new InteractionCapabilityRegistry();
        registry.issue(conversation, confirmation());
        registry.beginConfirmation(conversation, 'confirmation-1', 'action-1');
        registry.releaseConfirmation('confirmation-1');

        registry.beginConfirmation(conversation, 'confirmation-1', 'action-1');
        registry.completeConfirmation(conversation, 'confirmation-1', 'action-1', completedResult());
        expect(registry.consume(conversation, 'confirmation-1', {
            outcome: 'confirmed',
            action_id: 'action-1'
        })).toBeDefined();
    });

    test('returns the same completed result for confirmation request retries', () =>
    {
        const registry = new InteractionCapabilityRegistry();
        registry.issue(conversation, confirmation());
        expect(registry.beginConfirmation(conversation, 'confirmation-1', 'action-1')).toEqual({status: 'execute'});
        const result = completedResult();
        registry.completeConfirmation(conversation, 'confirmation-1', 'action-1', result);

        expect(registry.beginConfirmation(conversation, 'confirmation-1', 'action-1')).toEqual({
            status: 'completed',
            block: result
        });
        registry.consume(conversation, 'confirmation-1', {outcome: 'confirmed', action_id: 'action-1'});
        expect(registry.beginConfirmation(conversation, 'confirmation-1', 'action-1')).toEqual({
            status: 'completed',
            block: result
        });
    });

    test('releases a claimed UI result after a failed continuation', () =>
    {
        const registry = new InteractionCapabilityRegistry();
        registry.issue(conversation, selectForm());
        registry.consume(conversation, 'select-form', {tier: 'gold'});
        registry.releaseSubmission(conversation, 'select-form');

        expect(registry.consume(conversation, 'select-form', {tier: 'silver'})).toEqual({tier: 'silver'});
    });
});
