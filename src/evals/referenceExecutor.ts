import {executeNluiTool} from '../nlui/tools.ts';
import type {ChatToolTrace} from '../services/chatTrace.ts';
import {emptyTokenUsage} from '../services/chatTrace.ts';
import {toolReceipt} from '../services/traceAccounting.ts';
import {blockNameFor} from './blockNames.ts';
import {createIsolatedExecutor} from './isolatedExecutor.ts';
import {createOpenAIExecutor} from './openaiExecutor.ts';
import {referenceAnnotation, referenceArguments} from './referenceCases.ts';
import type {EvaluationScenario} from './scenario.ts';
import type {ScenarioExecutor} from './types.ts';

// An oracle/reference adapter, not an LLM simulator or evidence of model capability.
export const createReferenceExecutor = (catalog: EvaluationScenario[]): ScenarioExecutor => createIsolatedExecutor((data) =>
    createOpenAIExecutor({scenarios: catalog, chatRunner: async (request, emit, signal, observe) =>
    {
        const scenario = catalog.find((item) => request.input.type === 'user_text' && item.prompt === request.input.text);
        if (!scenario) throw new Error('No matching reference scenario');
        const messageId = crypto.randomUUID();
        const responseId = crypto.randomUUID();
        emit({type: 'message.started', messageId});
        const tools: ChatToolTrace[] = [];
        const blocks = [];
        for (const name of scenario.expectedTools)
        {
            signal.throwIfAborted();
            const args = referenceArguments(scenario, name);
            const started = performance.now();
            emit({type: 'tool.started', name});
            const execution = await executeNluiTool(name, JSON.stringify(args), signal, data);
            const receipt: ChatToolTrace = {...toolReceipt(execution), round: 1, callId: crypto.randomUUID(), name,
                arguments: args, modelOutput: execution.traceOutput ?? execution.modelOutput,
                candidateBlockIds: execution.blocks.map(({id}) => id), candidateBlockTypes: execution.blocks.map(({type}) => type),
                durationMs: performance.now() - started, cached: false,
                rejected: (execution.modelOutput as {ok?: boolean})?.ok === false, attempt: 1};
            tools.push(receipt);
            observe?.({type: 'tool.completed', tool: receipt});
            blocks.push(...execution.blocks.filter((block) => scenario.expectedBlocks.includes(blockNameFor(block))));
            emit({type: 'tool.completed', name});
        }
        const text = referenceAnnotation(scenario.id);
        emit({type: 'text.delta', delta: text});
        for (const block of blocks) emit({type: 'ui.block', block});
        emit({type: 'message.completed', messageId, responseId});
        return {messageId, responseId, model: 'deterministic-reference', promptVersion: 'reference-v1', text, blocks,
            tools, rounds: [], usage: emptyTokenUsage(), durationMs: 0};
    }}));
