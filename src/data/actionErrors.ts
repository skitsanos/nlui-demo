export const ACTION_ERROR_MESSAGES = {
    invalid_action_id: 'Invalid action identifier',
    action_not_found: 'The requested action was not found',
    action_not_pending: 'The requested action is no longer pending',
    action_expired: 'The requested action has expired',
    order_not_found: 'The order was not found',
    return_ineligible: 'This order is not eligible for a return',
    return_exists: 'This order already has a return',
    delivery_missing: 'This order has no recorded delivery date',
    return_window: 'This order is outside the 30-day return window',
    shipping_locked: 'The shipping address can no longer be changed',
    cancellation_locked: 'This order can no longer be cancelled',
    invalid_input: 'The action details are invalid. Please review them and try again.'
} as const;

export type ActionErrorCode = keyof typeof ACTION_ERROR_MESSAGES;

/** Only application-authored codes, never arbitrary exception messages, are public. */
export class ActionDomainError extends Error
{
    constructor(readonly code: ActionErrorCode)
    {
        super(ACTION_ERROR_MESSAGES[code]);
        this.name = 'ActionDomainError';
    }
}
