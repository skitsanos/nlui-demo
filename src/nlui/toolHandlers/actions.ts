import {actionArguments, detailsArguments} from '../toolArguments.ts';
import {getRepository, normalizeOrderNumber} from '../toolRuntime.ts';
import type {ToolContext, ToolExecution} from '../toolTypes.ts';
import type {FormBlock} from '../types.ts';

export const formHandler = (raw: unknown): ToolExecution =>
{
    const args = detailsArguments.parse(raw);
    const interactionId = `${args.kind}:${crypto.randomUUID()}`;
    const commonOrderField = {
        name: 'order_number',
        label: 'Order number',
        input: 'text' as const,
        required: true,
        placeholder: 'ORD-1042'
    };
    let block: FormBlock;

    if (args.kind === 'product_preferences')
    {
        block = {
            id: crypto.randomUUID(),
            type: 'form',
            interactionId,
            title: 'Tell me what you need',
            submitLabel: 'Find products',
            fields: [
                {name: 'use_case', label: 'Primary use', input: 'text', required: true, placeholder: 'Design, travel, development…'},
                {name: 'maximum_price_eur', label: 'Maximum price (€)', input: 'number', min: 1},
                {name: 'desk_requirements', label: 'Desk space and accessibility needs', input: 'textarea', maxLength: 300,
                    help: 'How much desk space is available? Include any accessibility or positioning needs.'},
                {name: 'device_requirements', label: 'Devices and connections', input: 'textarea', maxLength: 300,
                    help: 'Which devices will you use, and which ports or connections do they need?'},
                {name: 'preferences', label: 'Other preferences', input: 'textarea', maxLength: 300}
            ]
        };
    }
    else if (args.kind === 'shipping_address')
    {
        block = {
            id: crypto.randomUUID(),
            type: 'form',
            interactionId,
            title: 'Update shipping address',
            submitLabel: 'Review change',
            initialValues: args.order_number ? {order_number: args.order_number} : undefined,
            fields: [
                commonOrderField,
                {name: 'line1', label: 'Address', input: 'text', required: true},
                {name: 'city', label: 'City', input: 'text', required: true},
                {name: 'postal_code', label: 'Postal code', input: 'text', required: true},
                {name: 'country', label: 'Country', input: 'text', required: true}
            ]
        };
    }
    else
    {
        const needsReason = args.kind === 'return_request' || args.kind === 'cancellation';
        block = {
            id: crypto.randomUUID(),
            type: 'form',
            interactionId,
            title: args.kind === 'return_request' ? 'Request a return' : args.kind === 'cancellation' ? 'Cancel an order' : 'Find an order',
            submitLabel: needsReason ? 'Review request' : 'Find order',
            initialValues: args.order_number ? {order_number: args.order_number} : undefined,
            fields: [
                commonOrderField,
                ...args.kind === 'order_resolution' ? [{name: 'intended_outcome', label: 'What would you like to do?',
                    input: 'select' as const, required: true, options: [
                        {label: 'Track delivery', value: 'track'}, {label: 'Change shipping address', value: 'change_address'},
                        {label: 'Request a return', value: 'return'}, {label: 'Cancel the order', value: 'cancel'},
                        {label: 'Something else', value: 'other'}]}] : [],
                ...needsReason ? [{name: 'reason', label: 'Reason', input: 'textarea' as const, required: true, maxLength: 300}] : []
            ]
        };
    }

    return {modelOutput: {requested: args.kind}, blocks: [block]};
};

export const prepareActionHandler = (raw: unknown, context?: ToolContext): ToolExecution =>
{
    const args = actionArguments.parse(raw);
    if ((args.action_type === 'return_order' || args.action_type === 'cancel_order') && !args.reason)
    {
        return formHandler({
            kind: args.action_type === 'return_order' ? 'return_request' : 'cancellation',
            order_number: args.order_number
        });
    }
    if (args.action_type === 'update_shipping_address' && !args.address)
    {
        return formHandler({kind: 'shipping_address', order_number: args.order_number});
    }

    const orderNumber = normalizeOrderNumber(args.order_number);
    const confirmation = getRepository(context).prepareAction(args.action_type === 'update_shipping_address' ? {
        type: args.action_type,
        orderNumber,
        address: {
            line1: args.address!.line1,
            city: args.address!.city,
            postalCode: args.address!.postal_code,
            country: args.address!.country
        }
    } : {
        type: args.action_type,
        orderNumber,
        reason: args.reason!
    });

    return {
        modelOutput: {prepared: true, actionType: confirmation.actionType, orderNumber: confirmation.orderNumber},
        blocks: [{
            id: crypto.randomUUID(),
            type: 'confirmation',
            title: 'Review this action',
            description: confirmation.summary,
            actionId: confirmation.actionId,
            confirmLabel: 'Confirm action',
            cancelLabel: 'Keep everything unchanged',
            severity: confirmation.actionType === 'cancel_order' ? 'danger' : 'warning',
            details: [
                {label: 'Order', value: confirmation.orderNumber},
                {label: 'Action', value: confirmation.actionType.replaceAll('_', ' ')},
                {label: 'Expires', value: confirmation.expiresAt, format: 'date'}
            ]
        }]
    };
};
