import type {RouteContext} from '../core/types.ts';
import {InteractionCapabilityRegistry} from '../nlui/interactionCapabilities.ts';
import type {ToolDataSource} from '../nlui/toolTypes.ts';
import type {ConfirmationBlock, ResultBlock} from '../nlui/types.ts';
import {createActionPostHandler} from '../routes/api/actions.ts';
import type {EvaluationTrace, ScenarioExecutor} from './types.ts';

export const createRouteExecutor = (data: ToolDataSource): ScenarioExecutor => async ({scenario, runId, signal}) =>
{
    signal.throwIfAborted();
    if (!scenario.setup) throw new Error('Confirmation route requires a pending-action setup');
    const started = performance.now();
    const startedAt = new Date().toISOString();
    const prepared = data.repository.prepareAction(scenario.setup.pendingAction);
    const registry = new InteractionCapabilityRegistry();
    const conversationId = `eval-${crypto.randomUUID()}`;
    const confirmation: ConfirmationBlock = {id: crypto.randomUUID(), type: 'confirmation', actionId: prepared.actionId,
        confirmLabel: 'Confirm', details: []};
    registry.issue(conversationId, confirmation);
    const handler = createActionPostHandler({registry, reportError: () => undefined, confirmAction: (actionId) =>
    {
        const result = data.repository.confirmAction(actionId);
        const block: ResultBlock = {id: crypto.randomUUID(), type: 'result', status: 'success', message: result.message};
        return {modelOutput: result, blocks: [block]};
    }});
    const request = () => new Request('http://eval.invalid/api/actions', {method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({conversationId, interactionId: confirmation.id, actionId: confirmation.actionId})});
    const context = (req: Request) => ({req, params: {}, query: {}, pathname: '/api/actions'} as RouteContext);
    const response = await handler(context(request()));
    if (response?.status !== 200) throw new Error('Isolated confirmation route failed');
    const first = await response.json() as {block: ResultBlock};
    const firstDurationMs = performance.now() - started;
    signal.throwIfAborted();
    const retryStarted = performance.now();
    const retry = await handler(context(request()));
    const replay = await retry?.json() as {block?: ResultBlock; replayed?: boolean};
    const retryDurationMs = performance.now() - retryStarted;
    if (retry?.status !== 200 || replay.replayed !== true || JSON.stringify(first.block) !== JSON.stringify(replay.block))
    {
        throw new Error('Confirmation route replay was not idempotent');
    }
    const trace: EvaluationTrace = {traceVersion: 2, outcome: 'completed', scenarioId: scenario.id, runId,
        startedAt, completedAt: new Date().toISOString(), events: [], text: '', toolCalls: ['confirm_action', 'confirm_action'],
        toolExecutions: [{round: 1, callId: 'route-confirm', name: 'confirm_action', arguments: {actionId: prepared.actionId},
            modelOutput: {status: 'completed', replayed: false}, candidateBlockIds: [first.block.id], candidateBlockTypes: ['result'],
            durationMs: firstDurationMs, cached: false, rejected: false, outcome: 'accepted', attempt: 1},
            {round: 1, callId: 'route-confirm-retry', name: 'confirm_action', arguments: {actionId: prepared.actionId},
                modelOutput: {status: 'completed', replayed: true}, candidateBlockIds: [first.block.id], candidateBlockTypes: ['result'],
                durationMs: retryDurationMs, cached: true, rejected: false, outcome: 'accepted', attempt: 1}],
        blocks: [first.block], responseIds: [], latency: {totalMs: performance.now() - started}};
    return trace;
};
