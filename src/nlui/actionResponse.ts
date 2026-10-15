import {z} from 'zod';
import {ACTION_ERROR_MESSAGES} from '../data/actionErrors.ts';
import {nluiBlockSchema} from './schemas.ts';

export const GENERIC_PUBLIC_ACTION_ERROR = 'The action could not be completed. Please try again.';
export const UNAVAILABLE_ACTION_MESSAGE = 'This interaction is invalid or no longer available.';
export const BUSY_ACTION_MESSAGE = 'This action is still being processed. Please check its result again.';

export const actionFailureSchema = z.discriminatedUnion('outcome', [
    z.object({outcome: z.literal('rejected'), retryable: z.literal(false), message: z.enum(Object.values(ACTION_ERROR_MESSAGES))}),
    z.object({outcome: z.literal('unavailable'), retryable: z.literal(false), message: z.string().max(300)}),
    z.object({outcome: z.literal('unknown'), retryable: z.literal(true), message: z.enum([GENERIC_PUBLIC_ACTION_ERROR, BUSY_ACTION_MESSAGE])})
]);
export type ActionFailure = z.infer<typeof actionFailureSchema>;

export const actionSuccessSchema = z.object({
    block: nluiBlockSchema.refine((block) => block.type === 'result' && block.status === 'success'),
    replayed: z.boolean().optional()
});
