import {ACTION_ERROR_MESSAGES, ActionDomainError} from '../data/actionErrors.ts';
import {type ActionFailure, BUSY_ACTION_MESSAGE, GENERIC_PUBLIC_ACTION_ERROR, UNAVAILABLE_ACTION_MESSAGE} from '../nlui/actionResponse.ts';
import {InteractionCapabilityError} from '../nlui/interactionCapabilities.ts';
import Logger from '../utils/logger.ts';

export {GENERIC_PUBLIC_ACTION_ERROR} from '../nlui/actionResponse.ts';

const logger = new Logger('Actions');

export const publicActionError = (error: unknown): ActionFailure & {status: number} =>
{
    if (error instanceof InteractionCapabilityError)
    {
        if (error.code === 'in_progress') return {message: BUSY_ACTION_MESSAGE, status: 409, outcome: 'unknown', retryable: true};
        return {message: UNAVAILABLE_ACTION_MESSAGE, status: 400, outcome: 'unavailable', retryable: false};
    }
    if (error instanceof ActionDomainError && Object.hasOwn(ACTION_ERROR_MESSAGES, error.code))
    {
        return {message: ACTION_ERROR_MESSAGES[error.code], status: 409, outcome: 'rejected', retryable: false};
    }
    return {message: GENERIC_PUBLIC_ACTION_ERROR, status: 500, outcome: 'unknown', retryable: true};
};

export const actionErrorDiagnostic = (error: unknown) =>
{
    // Keep stack locations for operators, not exception messages, SQL or payloads.
    // Redact configured values even if a custom stack embeds one in a frame.
    let location = error instanceof Error
        ? (error.stack ?? '').split('\n').filter((line) => /^\s+at /.test(line)).slice(0, 8).join('\n')
        : '';
    for (const value of [process.env.OPENAI_API_KEY, process.env.CHAT_MODEL])
    {
        if (value) location = location.replaceAll(value, '[redacted]');
    }
    return {
        kind: error instanceof TypeError ? 'TypeError' : error instanceof Error ? 'Error' : 'NonError',
        location
    };
};

export const reportUnexpectedActionError = (error: unknown): void =>
{
    logger.error('Unexpected action confirmation failure', {incidentId: crypto.randomUUID(), ...actionErrorDiagnostic(error)});
};
