import {z} from 'zod';

// Bounded application-authored language, not a semantic classifier or a model grader.
export const RESPONSE_POLICIES = ['address_after_dispatch', 'delivered_cancellation'] as const;
export const responsePolicySchema = z.enum(RESPONSE_POLICIES);
export type ResponsePolicy = z.infer<typeof responsePolicySchema>;
export const RESPONSE_POLICY_VERSION = 'policy-captions-v1';
export const POLICY_CAPTIONS: Record<ResponsePolicy, readonly string[]> = {
    address_after_dispatch: [
        'An address can change only while an order is processing, before dispatch. This workflow cannot redirect an in-transit or delivered shipment.',
        'Once a shipment is in transit or delivered, its address cannot be changed here. Address changes are only available before dispatch, while processing.'
    ],
    delivered_cancellation: [
        'Delivered orders cannot be cancelled. I can help you check the return options instead.',
        'This order has already been delivered, so cancellation is unavailable. We can look at return eligibility instead.'
    ]
};

export const policyCaptions = (policies: readonly ResponsePolicy[]): string[] =>
{
    const unique = RESPONSE_POLICIES.filter((policy) => policies.includes(policy));
    // Reject unrecognized server metadata instead of silently removing a constraint.
    if (policies.some((policy) => !responsePolicySchema.safeParse(policy).success)) throw new Error('Unknown response policy');
    return unique.reduce<string[]>((captions, policy) => captions.flatMap((caption) =>
        POLICY_CAPTIONS[policy].map((part) => caption ? `${caption} ${part}` : part)), ['']).filter(Boolean);
};
