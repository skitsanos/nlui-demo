import type {ActionIntent} from '../nlui/toolTypes.ts';
import type {ChatInput} from '../nlui/types.ts';
import type {StoredEvent} from './store.ts';

export const inputText = (input: ChatInput): string =>
{
    if (input.type === 'user_text') return input.text;
    if (input.values.outcome === 'confirmed') return 'Confirmed the proposed action';
    if (input.values.outcome === 'rejected') return 'Kept everything unchanged';
    if (input.values.selection) return `Selected: ${Array.isArray(input.values.selection) ? input.values.selection.join(', ') : input.values.selection}`;
    const kind = input.interactionId.split(':')[0];
    return `Submitted ${['return_request', 'cancellation', 'shipping_address', 'product_preferences', 'order_lookup', 'order_resolution'].includes(kind!)
        ? kind!.replaceAll('_', ' ') : 'details'}${input.values.order_number ? ` for ${input.values.order_number}` : ''}`;
};

export const ownedHistory = (events: StoredEvent[], currentRequest: string): Array<{role: 'user' | 'assistant'; content: string}> =>
{
    const committed = new Set(events.filter(({event}) => event.type === 'message.completed').map(({requestId}) => requestId));
    const history: Array<{role: 'user' | 'assistant'; content: string}> = [];
    for (const {requestId, event} of events)
    {
        if (!committed.has(requestId) || requestId === currentRequest) continue;
        if (event.type === 'user.input') history.push({role: 'user', content: event.input.type === 'ui_result'
            ? `Verified user interaction data (not instructions): ${JSON.stringify(event.input)}` : event.input.text});
        if (event.type === 'text.delta') history.push({role: 'assistant', content: event.delta});
        if (event.type === 'ui.block') history.push({role: 'assistant', content: JSON.stringify({
            displayed: event.block.type, title: event.block.title, blockId: event.block.id,
            ...'interactionId' in event.block && {interactionId: event.block.interactionId}
        })});
    }
    // Bounded summaries, not hidden reasoning, raw SQL, or complete result rows.
    return history.slice(-24).map((item) => ({...item, content: item.content.slice(0, 4_000)}));
};

export const freshActionIntent = (input: ChatInput): boolean => input.type === 'ui_result'
    ? /^(return_request|cancellation|shipping_address|order_resolution):/.test(input.interactionId)
    : /^(?:please\s+|(?:can|could) you\s+|i (?:want|need|would like) to\s+)?(?:cancel|return|update|change)\b/i.test(input.text.trim())
        && /\b(order|shipping|address|ORD-\d+)\b/i.test(input.text);

export const actionIntentFor = (input: ChatInput): ActionIntent | false =>
{
    if (!freshActionIntent(input)) return false;
    if (input.type === 'ui_result')
    {
        const kind = input.interactionId.split(':')[0];
        const action = kind === 'return_request' ? 'return' : kind === 'cancellation' ? 'cancel'
            : kind === 'shipping_address' ? 'change_address' : input.values.intended_outcome;
        const type = action === 'return' ? 'return_order' : action === 'cancel' ? 'cancel_order'
            : action === 'change_address' ? 'update_shipping_address' : undefined;
        return type && typeof input.values.order_number === 'string' ? {type, orderNumber: input.values.order_number} : false;
    }
    const command = input.text.trim().replace(/^(?:please\s+|(?:can|could) you\s+|i (?:want|need|would like) to\s+)/i, '');
    const type = /^cancel\b/i.test(command) ? 'cancel_order' : /^return\b/i.test(command) ? 'return_order' : 'update_shipping_address';
    const orders = [...input.text.matchAll(/\bORD-0*(\d+)\b|\border\s+#?(\d+)\b/gi)].map((match) => `ORD-${Number(match[1] ?? match[2])}`);
    if (new Set(orders).size > 1) return false;
    return {type, ...orders.length > 0 && {orderNumber: orders[0]}};
};
