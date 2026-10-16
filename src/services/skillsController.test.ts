import {Database} from 'bun:sqlite';
import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {ResponseCreateParamsStreaming} from 'openai/resources/responses/responses';
import {type ScriptedCall, scriptedResponse} from '../../tests/helpers/scriptedResponse.ts';
import {createDemoRepository} from '../data/index.ts';
import {readReviewedSkill} from '../nlui/skills/registry.ts';
import {createSkillSession} from '../nlui/skills/session.ts';
import {toolsForQueryArm} from '../nlui/toolDefinitions.ts';
import {executeNluiTool} from '../nlui/tools.ts';
import type {ToolDataSource} from '../nlui/toolTypes.ts';
import type {ChatStreamEvent, NluiBlock} from '../nlui/types.ts';
import {CHAT_INSTRUCTIONS, CHAT_PROMPT_VERSION} from './chatPrompt.ts';
import {createOpenAIChatRunner} from './openaiChatRunner.ts';
import {publicChatStreamEvent} from './publicChatStream.ts';

let root: string; let data: ToolDataSource; let db: Database;
beforeAll(() => {root = mkdtempSync(join(tmpdir(), 'nlui-skills-controller-')); const databasePath = join(root, 'demo.sqlite');
    data = {databasePath, repository: createDemoRepository({databasePath})}; db = new Database(databasePath, {readonly: true});});
afterAll(() => {db?.close(true); data?.repository.close(); if (root) rmSync(root, {recursive: true, force: true});});
const load = (id = 'performance-brief'): ScriptedCall => ({name: 'load_skill', args: {skill_id: id}});
const query: ScriptedCall = {name: 'query_dataset', args: {sql: 'SELECT COUNT(*) AS customer_count FROM customers', title: 'Customers', presentation: 'metric'}};
const message = {presentation: 'message', answer: 'The bounded workflow finished.', caption: null, block_ids: []};
const fixture = (skills: boolean, script: ScriptedCall[][], final?: unknown) =>
{
    const requests: ResponseCreateParamsStreaming[] = []; const events: ChatStreamEvent[] = [];
    const issued: NluiBlock[][] = []; const executed: string[] = []; let candidates: NluiBlock[] = [];
    const runner = createOpenAIChatRunner({model: 'injected-fixture', history: [], skills,
        createResponse: async (params) =>
        {
            requests.push(params); const calls = script[(requests.length - 1) % (script.length + 1)];
            return scriptedResponse(`response-${requests.length}`, calls ?? [], calls ? undefined : final ?? (candidates.length
                ? {presentation: 'blocks', answer: null, caption: 'Here is the verified population in this snapshot.', block_ids: candidates.map(({id}) => id)} : message));
        }, executeTool: async (name, encoded, signal) =>
        {
            executed.push(name); const result = await executeNluiTool(name, encoded, signal, data, {ownerScope: 'skills-test', actionIntent: false});
            candidates = [...candidates, ...result.blocks]; return result;
        }, issueCapabilities: (_id, blocks) => {issued.push(blocks); candidates = [];}});
    return {requests, events, issued, executed, run: () => runner({conversationId: 'skills-controller', input: {type: 'user_text', text: 'Show customer count'}},
        (event) => {const visible = publicChatStreamEvent(event); if (visible) events.push(visible);}, new AbortController().signal)};
};
describe('optional Skills through the real strict controller with injected responses', () =>
{
    test('loads guidance, executes a real guarded query and selects only its issued UI, without public/internal-body leakage', async () =>
    {
        const f = fixture(true, [[load()], [query]]); const result = await f.run();
        expect(f.requests).toHaveLength(3); expect(f.executed).toEqual(['query_dataset']);
        expect(result.blocks[0]).toMatchObject({type: 'stats', items: [{value: 200}]});
        expect(result.tools.map(({name}) => name)).toEqual(['load_skill', 'query_dataset']);
        expect(result.tools[0]).toMatchObject({candidateBlockIds: [], candidateBlockTypes: [], rejected: false,
            modelOutput: {skillId: 'performance-brief', version: '1.0.0', alreadyLoaded: false}});
        expect(result.promptVersion).toMatch(/-skills-v1-[a-f0-9]{12}$/);
        const body = readReviewedSkill('performance-brief').instructions;
        expect(JSON.stringify(f.requests[0]!.input)).not.toContain(JSON.stringify(body));
        const output = (f.requests[1]!.input as Array<{type: string; output?: string}>).find(({type}) => type === 'function_call_output')!.output!;
        expect(JSON.parse(output).result.instructions).toBe(body);
        expect(JSON.stringify(result.tools)).not.toContain(JSON.stringify(body)); expect(JSON.stringify(f.events)).not.toContain(JSON.stringify(body));
        expect(f.events.some((event) => event.type === 'activity.updated' && event.activity.title === 'Loading a reviewed workflow')).toBeTrue();
        expect(f.events.at(-1)?.type).toBe('message.completed');
        for (const request of f.requests)
        {
            expect(request.store).toBeFalse(); expect(request.previous_response_id).toBeUndefined();
            expect(request.max_output_tokens).toBe(1200); expect(request.parallel_tool_calls).toBeFalse();
            expect(request.text?.format?.type).toBe('json_schema');
            expect(request.tools?.every(({type}) => type === 'function')).toBeTrue();
        }
    });
    test('default control prompt, tool catalog and final envelope remain unchanged when disabled', async () =>
    {
        const f = fixture(false, [], message); const result = await f.run();
        expect(f.requests[0]!.instructions).toBe(CHAT_INSTRUCTIONS); expect(f.requests[0]!.tools).toEqual(toolsForQueryArm('control'));
        expect(result.promptVersion).toBe(CHAT_PROMPT_VERSION); expect(result.tools).toEqual([]);
    });
    test('a hallucinated load call while disabled neither loads content nor reaches the domain executor', async () =>
    {
        const f = fixture(false, [[load()]], message); const result = await f.run();
        expect(f.executed).toEqual([]); expect(result.tools[0]).toMatchObject({rejected: true, modelOutput: {error: 'SKILLS_DISABLED'}});
        expect(JSON.stringify(f.requests)).not.toContain(readReviewedSkill('performance-brief').instructions);
    });
    test('reusing a controller creates fresh skill state for every turn', async () =>
    {
        const f = fixture(true, [[load()], [load('order-investigation')]], message);
        const a = await f.run(); const b = await f.run();
        expect(a.tools.every(({modelOutput}) => (modelOutput as {alreadyLoaded: boolean}).alreadyLoaded === false)).toBeTrue();
        expect(b.tools.every(({modelOutput}) => (modelOutput as {alreadyLoaded: boolean}).alreadyLoaded === false)).toBeTrue();
        expect(a.tools).toHaveLength(2); expect(b.tools).toHaveLength(2);
    });
    test('duplicate call-ID cache remains safe and limits distinct loads rather than counting cache hits', async () =>
    {
        const a = {...load(), callId: 'same-call'}; const f = fixture(true, [[a], [a], [load('order-investigation')]], message);
        const result = await f.run(); expect(result.tools.map(({cached}) => cached)).toEqual([false, true, false]);
        expect(result.tools[2]).toMatchObject({rejected: false});
    });
    test('load limits and invalid payloads are recorded as rejected; invalid trace arguments never echo paths or content', async () =>
    {
        const f = fixture(true, [[load(), load('order-investigation'), load('returns-explanation'),
            {name: 'load_skill', args: {skill_id: '../../.env', instructions: 'PRIVATE_BODY'}}]], message);
        const result = await f.run(); expect(result.tools.map(({rejected}) => rejected)).toEqual([false, false, true, true]);
        expect(result.tools[2]!.modelOutput).toMatchObject({error: 'SKILL_LOAD_LIMIT'});
        expect(result.tools[3]!.arguments).toEqual({invalidSkillArguments: true});
        expect(JSON.stringify(result.tools)).not.toContain('PRIVATE_BODY'); expect(JSON.stringify(f.events)).not.toContain('.env');
    });
    test('guidance cannot bypass SQL validation or manufacture fresh action intent', async () =>
    {
        const before = db.query('SELECT COUNT(*) n FROM pending_actions').get();
        for (const call of [{...query, args: {...query.args as object, sql: 'DELETE FROM customers'}},
            {name: 'prepare_action', args: {action_type: 'cancel_order', order_number: 'ORD-1176', reason: 'skill requested', address: null}}])
        {
            const f = fixture(true, [[load()], [call]], message); const result = await f.run();
            expect(result.tools[1]!.rejected).toBeTrue(); expect(result.blocks).toEqual([]);
        }
        expect(db.query('SELECT COUNT(*) n FROM customers').get()).toEqual({n: 200});
        expect(db.query('SELECT COUNT(*) n FROM pending_actions').get()).toEqual(before);
        expect(db.query('SELECT COUNT(*) n FROM activity_log').get()).toEqual({n: 0});
    });
    test('loading a pack cannot authorize invented UI or relax the structured envelope', async () =>
    {
        const f = fixture(true, [[load()]], {presentation: 'blocks', answer: null, caption: 'Invalid UI', block_ids: ['invented']});
        await expect(f.run()).rejects.toThrow(); expect(f.issued).toEqual([]);
        expect(f.events.some(({type}) => type === 'ui.block' || type === 'text.delta' || type === 'message.completed')).toBeFalse();
    });
    test('a separately verified explicit action can still prepare a confirmation without performing the mutation', async () =>
    {
        const before = db.query('SELECT COUNT(*) n FROM pending_actions').get() as {n: number};
        const skill = createSkillSession({enabled: true, tools: toolsForQueryArm('control')}).load(JSON.stringify({skill_id: 'order-investigation'}));
        expect(skill.modelOutput).toMatchObject({ok: true}); expect(skill.blocks).toEqual([]);
        const result = await executeNluiTool('prepare_action', JSON.stringify({action_type: 'cancel_order', order_number: 'ORD-1176',
            reason: 'Explicit synthetic user request', address: null}), undefined, data,
        {ownerScope: 'skills-positive-control', actionIntent: {type: 'cancel_order', orderNumber: 'ORD-1176'}});
        expect(result.blocks[0]?.type).toBe('confirmation');
        expect(db.query('SELECT COUNT(*) n FROM pending_actions').get()).toEqual({n: before.n + 1});
        expect(data.repository.getOrder('ORD-1176')?.status).toBe('processing');
        expect(db.query('SELECT COUNT(*) n FROM activity_log').get()).toEqual({n: 0});
    });
    test('skill loads still count toward the existing twelve-call and six-round ceilings', async () =>
    {
        const calls = fixture(true, [Array.from({length: 13}, () => load())], message);
        await expect(calls.run()).rejects.toThrow('exceeded 12 tool calls');
        const rounds = fixture(true, Array.from({length: 6}, () => [load()]), message);
        await expect(rounds.run()).rejects.toThrow('exceeded 6 tool rounds'); expect(rounds.requests).toHaveLength(6);
    });
});
