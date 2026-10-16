import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {SocketData} from '../../src/core/types.ts';
import {createDemoRepository} from '../../src/data/index.ts';
import {featureEnabled} from '../../src/nlui/features.ts';
import {SKILL_CATALOG} from '../../src/nlui/skills/registry.ts';
import {createSkillSession} from '../../src/nlui/skills/session.ts';
import {toolsForQueryArm} from '../../src/nlui/toolDefinitions.ts';
import {executeNluiTool} from '../../src/nlui/tools.ts';
import type {NluiBlock} from '../../src/nlui/types.ts';
import {GET as configuration} from '../../src/routes/api/config.ts';
import {createDocsHandler} from '../../src/routes/docs/[...slug].ts';
import {createOpenAIChatRunner} from '../../src/services/openaiChatRunner.ts';
import {publicChatStreamEvent} from '../../src/services/publicChatStream.ts';
import {isCompiled} from '../../src/utils/runtime.ts';
import {scriptedResponse} from '../helpers/scriptedResponse.ts';

// No provider client. Network calls from this child are forbidden even if a regression tries one.
globalThis.fetch = (() => {throw new Error('Network transport is forbidden in the Skills fixture');}) as unknown as typeof fetch;
const root = process.env.SKILLS_FIXTURE_ROOT ?? await mkdtemp(join(tmpdir(), 'nlui-skills-http-'));
const databasePath = join(root, 'demo.sqlite'); const repository = createDemoRepository({databasePath});
const enabled = featureEnabled('skills'); const docs = createDocsHandler();
const server = Bun.serve({hostname: '127.0.0.1', port: 0, async fetch(req, server)
{
    const url = new URL(req.url);
    if (url.pathname === '/api/config') return await configuration({req, server: server as unknown as Bun.Server<SocketData>, pathname: url.pathname, params: {}, query: {}})
        ?? new Response(null, {status: 500});
    if (url.pathname.startsWith('/docs/')) return await docs({req, server: server as unknown as Bun.Server<SocketData>, pathname: url.pathname,
        params: {slug: url.pathname.slice(6)}, query: {}}) ?? new Response(null, {status: 404});
    if (url.pathname === '/api/fixture/skills')
    {
        const session = createSkillSession({enabled, tools: toolsForQueryArm('control')});
        return Response.json({enabled, compiled: isCompiled, tools: session.tools.map(({name}) => name),
            catalog: enabled ? SKILL_CATALOG : [], attempted: session.load(JSON.stringify({skill_id: url.searchParams.get('id') ?? 'performance-brief'}))});
    }
    if (url.pathname === '/api/fixture/workflow')
    {
        let rounds = 0; const blocks: NluiBlock[] = []; const events: unknown[] = [];
        const runner = createOpenAIChatRunner({model: 'injected-fixture', history: [], skills: enabled,
            createResponse: async () =>
            {
                const round = ++rounds;
                return round === 1 ? scriptedResponse('load', [{name: 'load_skill', args: {skill_id: 'performance-brief'}}])
                    : round === 2 ? scriptedResponse('query', [{name: 'query_dataset', args: {sql: 'SELECT COUNT(*) AS customer_count FROM customers', title: 'Customers', presentation: 'metric'}}])
                        : scriptedResponse('final', [], {presentation: 'blocks', answer: null, caption: 'Here is the verified customer population.', block_ids: blocks.map(({id}) => id)});
            }, executeTool: async (name, encoded, signal) =>
            {const result = await executeNluiTool(name, encoded, signal, {databasePath, repository}, {actionIntent: false}); blocks.push(...result.blocks); return result;},
            issueCapabilities: () => undefined});
        const result = await runner({conversationId: 'skills-fixture', input: {type: 'user_text', text: 'Count customers'}},
            (event) => {const visible = publicChatStreamEvent(event); if (visible) events.push(visible);}, new AbortController().signal);
        return Response.json({evidenceKind: 'injected_reference', providerRequests: 0, enabled, result, events});
    }
    return new Response(null, {status: 404});
}});
let closing = false;
const close = async () => {if (closing) return; closing = true; await server.stop(true); repository.close(); await rm(root, {recursive: true, force: true}); process.exit(0);};
process.on('SIGINT', () => {void close();}); process.on('SIGTERM', () => {void close();});
console.log(`FIXTURE_READY ${server.port}`);
