import {describe, expect, test} from 'bun:test';
import {GENERIC_PUBLIC_ACTION_ERROR} from '../nlui/actionResponse.ts';
import type {ChatInput, ResultBlock} from '../nlui/types.ts';
import {ConfirmationController} from './confirmationController.ts';
import type {ConfirmationOutcome, RequestConfirmation} from './confirmationRequest.ts';

const identity = {conversationId: 'confirmation-test', interactionId: 'interaction-one', actionId: 'action-one'};
const block: ResultBlock = {id: 'result-one', type: 'result', status: 'success', title: 'Action completed', message: 'Completed once'};
const success: ConfirmationOutcome = {outcome: 'completed', block, replayed: false};
const unknown: ConfirmationOutcome = {outcome: 'unknown', retryable: true, message: GENERIC_PUBLIC_ACTION_ERROR};
const completed = async () => true;

describe('confirmation recovery state', () =>
{
    test('a failed action request keeps a retry using exactly the original IDs', async () =>
    {
        const requests: unknown[] = [];
        const inputs: ChatInput[] = [];
        const controller = new ConfirmationController(identity, async (ids) =>
        {requests.push(ids); return requests.length === 1 ? unknown : {...success, replayed: true};});
        await controller.confirm(completed);
        expect(controller.getSnapshot()).toMatchObject({phase: 'uncertain', retryable: true});
        await controller.confirm(async (input) => {inputs.push(input); return true;});
        expect(requests).toEqual([identity, identity]);
        expect(inputs).toEqual([{type: 'ui_result', interactionId: identity.interactionId,
            values: {outcome: 'confirmed', action_id: identity.actionId}}]);
        expect(controller.getSnapshot()).toMatchObject({phase: 'completed', recovered: true, result: block});
        expect(controller.getSnapshot().continuation).toBeUndefined();
    });

    test('a thrown dependency stays uncertain rather than discarding the confirmation', async () =>
    {
        const controller = new ConfirmationController(identity, async () => {throw new Error('private');});
        await controller.confirm(completed);
        expect(controller.getSnapshot()).toEqual({phase: 'uncertain', retryable: true, continuing: false});
    });

    test('rapid confirm and cancel clicks cannot dispatch another request or a rejected UI result', async () =>
    {
        let resolve: (value: ConfirmationOutcome) => void;
        let calls = 0;
        let continuations = 0;
        const controller = new ConfirmationController(identity, () =>
        {calls += 1; return new Promise((done) => {resolve = done;});});
        const callback = async () => {continuations += 1; return true;};
        const pending = controller.confirm(callback);
        await controller.confirm(callback);
        await controller.reject(callback);
        expect(calls).toBe(1);
        expect(continuations).toBe(0);
        resolve!(success);
        await pending;
        expect(continuations).toBe(1);
        await controller.confirm(callback);
        expect(calls).toBe(1);
    });

    test.each(['rejected', 'unavailable'] as const)('an initial known %s does not offer a mutation retry', async (outcome) =>
    {
        let calls = 0;
        const send: RequestConfirmation = async () =>
        {calls += 1; return {outcome, retryable: false, message: 'The requested action has expired'};};
        const controller = new ConfirmationController(identity, send);
        await controller.confirm(completed);
        expect(controller.getSnapshot()).toMatchObject({phase: 'rejected'});
        await controller.confirm(completed);
        expect(calls).toBe(1);
    });

    test.each(['rejected', 'unavailable'] as const)('a later %s never rewrites an ambiguous past as no mutation', async (outcome) =>
    {
        let calls = 0;
        const send: RequestConfirmation = async () => ++calls === 1 ? unknown
            : {outcome, retryable: false, message: 'The requested action has expired'};
        const controller = new ConfirmationController(identity, send);
        await controller.confirm(completed);
        await controller.reject(completed);
        expect(controller.getSnapshot().phase).toBe('uncertain');
        await controller.confirm(completed);
        expect(controller.getSnapshot()).toEqual({phase: 'uncertain', retryable: false, continuing: false});
        await controller.confirm(completed);
        expect(calls).toBe(2);
    });

    test.each(['false', 'throw'])('a %s chat continuation preserves the successful result and retries only chat', async (failure) =>
    {
        let actions = 0;
        let chats = 0;
        const controller = new ConfirmationController(identity, async () => {actions += 1; return success;});
        await controller.confirm(async () => {chats += 1; if (failure === 'throw') throw new Error('private'); return false;});
        expect(controller.getSnapshot()).toMatchObject({phase: 'completed', result: block, continuing: false});
        expect(controller.getSnapshot().continuation).toBeDefined();
        await controller.continueChat(async () => {chats += 1; return true;});
        expect(controller.getSnapshot().continuation).toBeUndefined();
        expect(actions).toBe(1);
        expect(chats).toBe(2);
    });

    test('chat continuation retries are single-flight too', async () =>
    {
        const controller = new ConfirmationController(identity, async () => success);
        await controller.confirm(async () => false);
        let calls = 0;
        let resolve: (value: boolean) => void;
        const callback = () => {calls += 1; return new Promise<boolean>((done) => {resolve = done;});};
        const pending = controller.continueChat(callback);
        await controller.continueChat(callback);
        expect(controller.getSnapshot().continuing).toBeTrue();
        expect(calls).toBe(1);
        resolve!(true);
        await pending;
        expect(controller.getSnapshot().continuing).toBeFalse();
    });

    test('cancel before submission never calls the action endpoint and can retry its chat continuation', async () =>
    {
        let actions = 0;
        const inputs: ChatInput[] = [];
        const controller = new ConfirmationController(identity, async () => {actions += 1; return success;});
        await controller.reject(async (input) => {inputs.push(input); return false;});
        expect(controller.getSnapshot()).toMatchObject({phase: 'cancelled', result: {message: 'No action was submitted.'}});
        await controller.confirm(completed);
        await controller.continueChat(async (input) => {inputs.push(input); return true;});
        expect(actions).toBe(0);
        expect(inputs).toHaveLength(2);
        expect(inputs[0]).toEqual(inputs[1]);
        expect(inputs[0]?.type === 'ui_result' && inputs[0].values.outcome).toBe('rejected');
    });

    test('unmount/reset aborts pending work and ignores a late result without continuing the old conversation', async () =>
    {
        let resolve: (value: ConfirmationOutcome) => void;
        let signal: AbortSignal;
        let chats = 0;
        const controller = new ConfirmationController(identity, (_ids, abort) =>
        {signal = abort; return new Promise((done) => {resolve = done;});});
        const pending = controller.confirm(async () => {chats += 1; return true;});
        controller.cancelPending();
        expect(signal!.aborted).toBeTrue();
        resolve!(success);
        await pending;
        expect(chats).toBe(0);
        expect(controller.getSnapshot().phase).toBe('uncertain');
    });

    test('subscriptions observe transitions and unsubscribe safely', async () =>
    {
        const phases: string[] = [];
        const controller = new ConfirmationController(identity, async () => unknown);
        const stop = controller.subscribe(() => phases.push(controller.getSnapshot().phase));
        await controller.confirm(completed);
        stop();
        await controller.confirm(completed);
        expect(phases).toEqual(['submitting', 'uncertain']);
    });

    test('a late abandoned request cannot overwrite a newer successful retry', async () =>
    {
        let resolve: (value: ConfirmationOutcome) => void;
        let calls = 0;
        let chats = 0;
        const controller = new ConfirmationController(identity, () => ++calls === 1
            ? new Promise((done) => {resolve = done;}) : Promise.resolve(success));
        const callback = async () => {chats += 1; return true;};
        const abandoned = controller.confirm(callback);
        controller.cancelPending();
        await controller.confirm(callback);
        resolve!(unknown);
        await abandoned;
        expect(controller.getSnapshot()).toMatchObject({phase: 'completed', result: block});
        expect(chats).toBe(1);
    });
});
