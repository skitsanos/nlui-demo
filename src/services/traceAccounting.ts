import type {ToolExecution} from '../nlui/toolTypes.ts';
import type {ChatRoundTrace, ChatToolTrace} from './chatTrace.ts';

export const traceFailureOutcome = (error: unknown, signal: AbortSignal): Exclude<ChatRoundTrace['outcome'], 'completed' | undefined> =>
{
    const cause = signal.aborted ? signal.reason : error;
    if (cause instanceof Error && cause.name === 'TimeoutError') return 'timeout';
    if (signal.aborted || (cause instanceof Error && cause.name === 'AbortError')) return 'cancelled';
    const message = cause instanceof Error ? cause.message : '';
    return /incomplete/i.test(message) ? 'incomplete'
        : /without successful completion|stream continued|changed response identifiers/i.test(message) ? 'truncated' : 'error';
};

export const toolReceipt = (execution: ToolExecution): Pick<ChatToolTrace, 'queryHash' | 'planHash' | 'policyCode' | 'emptyResult' | 'outcome'> =>
{
    const output = execution.traceOutput ?? execution.modelOutput;
    const record = typeof output === 'object' && output !== null ? output as Record<string, unknown> : {};
    const model = typeof execution.modelOutput === 'object' && execution.modelOutput !== null
        ? execution.modelOutput as Record<string, unknown> : {};
    const code = typeof model.error === 'string' ? model.error.match(/^SQL_[A-Z_]+/)?.[0] : undefined;
    const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
    return {outcome: model.ok === false ? 'rejected' : 'accepted',
        ...hash(record.queryHash) && {queryHash: record.queryHash},
        ...hash(record.planHash) && {planHash: record.planHash},
        ...code && {policyCode: code},
        ...typeof record.returnedRowCount === 'number' && {emptyResult: record.returnedRowCount === 0}};
};
