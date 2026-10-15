import {GENERIC_PUBLIC_ACTION_ERROR} from '../nlui/actionResponse.ts';
import type {ChatInput, ResultBlock} from '../nlui/types.ts';
import {type ConfirmationIdentity, type ConfirmationOutcome, type RequestConfirmation, requestConfirmation} from './confirmationRequest.ts';

export type ContinueInteraction = (input: ChatInput, displayText: string) => Promise<boolean>;
interface Continuation {input: ChatInput; displayText: string}
export interface ConfirmationState
{
    phase: 'ready' | 'submitting' | 'uncertain' | 'rejected' | 'completed' | 'cancelled';
    message?: string;
    retryable?: boolean;
    recovered?: boolean;
    result?: ResultBlock;
    continuation?: Continuation;
    continuing: boolean;
}

/** The identity never changes across retries; action execution and chat continuation are separate. */
export class ConfirmationController
{
    private state: ConfirmationState = {phase: 'ready', continuing: false};
    private readonly listeners = new Set<() => void>();
    private request?: AbortController;
    private generation = 0;

    constructor(private readonly identity: ConfirmationIdentity, private readonly send: RequestConfirmation = requestConfirmation) {}

    getSnapshot = (): ConfirmationState => this.state;
    subscribe = (listener: () => void): (() => void) =>
    {
        this.listeners.add(listener);
        return () => {this.listeners.delete(listener);};
    };
    private update(next: ConfirmationState): void
    {
        this.state = next;
        for (const listener of this.listeners) listener();
    }

    confirm = async (onInteraction: ContinueInteraction): Promise<void> =>
    {
        if (this.state.phase !== 'ready' && !(this.state.phase === 'uncertain' && this.state.retryable)) return;
        const wasUncertain = this.state.phase === 'uncertain';
        const generation = this.generation;
        const controller = new AbortController();
        this.request = controller;
        this.update({...this.state, phase: 'submitting'});
        let outcome: ConfirmationOutcome;
        try {outcome = await this.send({...this.identity}, controller.signal);}
        catch {outcome = {outcome: 'unknown', retryable: true, message: GENERIC_PUBLIC_ACTION_ERROR};}
        if (generation !== this.generation) return;
        this.request = undefined;
        if (outcome.outcome === 'completed')
        {
            this.update({phase: 'completed', result: outcome.block, recovered: wasUncertain || outcome.replayed, continuing: false,
                continuation: this.continuation('confirmed', outcome.block.message)});
            await this.continueChat(onInteraction);
        }
        else if (outcome.outcome === 'unknown' || wasUncertain)
        {
            this.update({phase: 'uncertain', continuing: false, retryable: outcome.retryable});
        }
        else
        {
            this.update({phase: 'rejected', continuing: false, message: outcome.outcome === 'rejected'
                ? outcome.message : 'This confirmation is no longer available. Ask for a new proposal after checking the order.'});
        }
    };

    reject = async (onInteraction: ContinueInteraction): Promise<void> =>
    {
        // Cancellation is never offered while a request is in flight or its outcome is unknown.
        if (this.state.phase !== 'ready') return;
        this.update({phase: 'cancelled', continuing: false,
            result: {id: `${this.identity.interactionId}-cancelled`, type: 'result', status: 'info',
                title: 'Action cancelled', message: 'No action was submitted.'},
            continuation: this.continuation('rejected', 'Cancelled the proposed action')});
        await this.continueChat(onInteraction);
    };

    continueChat = async (onInteraction: ContinueInteraction): Promise<void> =>
    {
        const {continuation, continuing} = this.state;
        if (!continuation || continuing) return;
        const generation = this.generation;
        this.update({...this.state, continuing: true});
        let completed = false;
        try {completed = await onInteraction(continuation.input, continuation.displayText);}
        catch { /* A continuation error cannot turn a committed action into an action failure. */ }
        if (generation !== this.generation) return;
        this.update({...this.state, continuing: false, continuation: completed ? undefined : continuation});
    };

    cancelPending = (): void =>
    {
        this.generation += 1;
        this.request?.abort();
        this.request = undefined;
        if (this.state.phase === 'submitting') this.update({phase: 'uncertain', continuing: false, retryable: true});
        else if (this.state.continuing) this.update({...this.state, continuing: false});
    };

    private continuation(outcome: 'confirmed' | 'rejected', displayText: string): Continuation
    {
        return {displayText, input: {type: 'ui_result', interactionId: this.identity.interactionId,
            values: {outcome, action_id: this.identity.actionId}}};
    }
}
