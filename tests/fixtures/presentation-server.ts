import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {SocketData} from '../../src/core/types.ts';
import {createDemoRepository} from '../../src/data/index.ts';
import {referenceAnnotation, referenceArguments} from '../../src/evals/referenceCases.ts';
import {loadEvaluationScenarios} from '../../src/evals/scenario.ts';
import {ConversationStateRegistry} from '../../src/nlui/conversationState.ts';
import {InteractionCapabilityRegistry} from '../../src/nlui/interactionCapabilities.ts';
import {policyCaptions} from '../../src/nlui/responsePolicy.ts';
import {executeNluiTool} from '../../src/nlui/tools.ts';
import type {ChatInput, NluiBlock} from '../../src/nlui/types.ts';
import {createChatHandler} from '../../src/routes/api/chat/index.ts';
import {emptyTokenUsage} from '../../src/services/chatTrace.ts';
import homepage from './presentation.html';

// Real production controls/tools and capability boundary, but no provider or retained database.
const root = await mkdtemp(join(tmpdir(), 'nlui-presentation-browser-'));
const databasePath = join(root, 'demo.sqlite');
const repository = createDemoRepository({databasePath});
const capabilities = new InteractionCapabilityRegistry();
const cases = ['products-laptop-travel', 'products-compare-laptops', 'products-design-monitor', 'products-office-bundle',
    'disambiguation-order', 'policy-address-change', 'action-cancel-delivered-refusal'];
const examples: Array<{id: string; prompt: string; conversationId: string; blocks: NluiBlock[]; caption: string}> = [];
for (const scenario of (await loadEvaluationScenarios()).filter(({id}) => cases.includes(id)))
{
    const name = scenario.expectedTools[0]!;
    const execution = await executeNluiTool(name, JSON.stringify(referenceArguments(scenario, name)), undefined, {databasePath, repository});
    const conversationId = `presentation-${scenario.id}`;
    for (const block of execution.blocks) capabilities.issue(conversationId, block);
    examples.push({id: scenario.id, prompt: scenario.prompt, conversationId, blocks: execution.blocks,
        caption: policyCaptions(execution.responsePolicy ? [execution.responsePolicy] : [])[0] ?? referenceAnnotation(scenario.id)});
}
const received: ChatInput[] = [];
const handler = createChatHandler({capabilities, states: new ConversationStateRegistry(), runChat: async (request, emit) =>
{
    if (request.input.type !== 'ui_result') throw new Error('Fixture accepts typed results only');
    received.push(request.input);
    const messageId = crypto.randomUUID();
    const responseId = crypto.randomUUID();
    emit({type: 'message.started', messageId});
    emit({type: 'text.delta', delta: 'Thanks — your choices were received. No order action has been authorized or executed.'});
    emit({type: 'message.completed', messageId, responseId});
    return {messageId, responseId, text: '', blocks: [], tools: [], rounds: [], model: 'provider-free-fixture',
        promptVersion: 'fixture', usage: emptyTokenUsage(), durationMs: 0};
}});
const server = Bun.serve<SocketData>({hostname: '127.0.0.1', port: 0, routes: {'/': homepage}, development: {console: true},
    async fetch(req, running)
    {
        const pathname = new URL(req.url).pathname;
        if (pathname === '/api/fixture') return Response.json(examples);
        if (pathname === '/api/fixture/state') return Response.json({received});
        if (pathname === '/api/chat') return await handler({req, server: running, params: {}, query: {}, pathname}) ?? new Response(null, {status: 500});
        return new Response(null, {status: 404});
    }});
let closing = false;
const close = async () =>
{
    if (closing) return;
    closing = true;
    await server.stop(true);
    repository.close();
    await rm(root, {recursive: true, force: true});
    process.exit(0);
};
process.on('SIGINT', () => {void close();});
process.on('SIGTERM', () => {void close();});
console.log(`FIXTURE_READY ${server.port}`);
