import {createHash} from 'node:crypto';
import type {FunctionTool} from 'openai/resources/responses/responses';
import {queryDataset, queryParameterizedDataset } from '../data/queryDataset.ts';
import {canonicalizeDatasetQuery} from '../data/queryPolicy.ts';
import {compileSemanticQuery} from '../data/semantic/compiler.ts';
import {semanticCatalogGuide} from '../data/semantic/metadata.ts';
import {InteractionCapabilityRegistry} from '../nlui/interactionCapabilities.ts';
import {toolsForQueryArm} from '../nlui/toolDefinitions.ts';
import type {ToolDataSource} from '../nlui/toolTypes.ts';
import {chatInstructionsFor} from '../services/chatPrompt.ts';
import {createConfiguredOpenAIChatRunner} from '../services/openaiChat.ts';
import type {ProviderRequestBudget} from './budget.ts';
import type {ResearchQueryArm, ResearchQueryCase} from './queryCases.ts';

export const researchTools = (arm: ResearchQueryArm): FunctionTool[] =>
{
    const control = toolsForQueryArm('control');
    if (arm === 'fixed') return control.filter(({name}) => name !== 'query_dataset');
    if (arm === 'semantic') return toolsForQueryArm('semantic');
    if (arm === 'hybrid') return [...control, toolsForQueryArm('semantic').find(({name}) => name === 'semantic_query')!];
    return control;
};

const tuples = (result: Awaited<ReturnType<typeof queryDataset>>): string[] => result.rows.map((row) =>
    JSON.stringify(result.columns.map(({key}) => row[key]))).sort();

export const runResearchQuery = async (item: ResearchQueryCase, arm: ResearchQueryArm, data: ToolDataSource, budget: ProviderRequestBudget) =>
{
    const oracle = compileSemanticQuery(item.plan);
    const expected = await queryParameterizedDataset(oracle.sql, oracle.parameters, {databasePath: data.databasePath});
    let reservation = 0; let requests = 0; let firstUsefulMs: number | null = null;
    const started = performance.now(); const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    const attempts: Array<{name: string; rejected: boolean; queryHash?: string; planHash?: string}> = [];
    const instructions = arm === 'fixed'
        ? `${chatInstructionsFor('control')}\nOnly fixed tools are available; do not invent missing generic capabilities. Explain when they cannot answer exactly.`
        : arm === 'hybrid' ? `${chatInstructionsFor('control')}\nPrefer semantic_query for a metric defined in the following catalog; use guarded query_dataset only when it cannot express the exact request.\n${semanticCatalogGuide()}`
            : chatInstructionsFor(arm);
    try
    {
        const runner = createConfiguredOpenAIChatRunner(arm === 'semantic' ? 'semantic' : 'control', data, new InteractionCapabilityRegistry(), {
            history: [], tools: researchTools(arm), instructions, promptVersion: `nlui-research-v3-${arm}`,
            beforeProviderRequest: () => {reservation = budget.reserve(`${item.id}:${arm}`); requests++;},
            context: {actionIntent: false}
        });
        const result = await runner({conversationId: crypto.randomUUID(), input: {type: 'user_text', text: item.prompt}},
            (event) => {if ((event.type === 'ui.block' || event.type === 'text.delta') && firstUsefulMs === null) firstUsefulMs = performance.now() - started;},
            controller.signal, (event) =>
            {
                if (event.type === 'round.completed') budget.account(reservation, event.round);
                else attempts.push({name: event.tool.name, rejected: event.tool.rejected, queryHash: event.tool.queryHash, planHash: event.tool.planHash});
            });
        const query = result.tools.findLast((tool) => !tool.rejected && (tool.name === 'query_dataset' || tool.name === 'semantic_query'));
        let denotation = false; let planMatch = false;
        if (query)
        {
            const args = query.arguments as Record<string, any>;
            if (query.name === 'semantic_query')
            {
                const p = args.plan;
                const actual = compileSemanticQuery({metric: p.metric, dimensions: p.dimensions, filters: p.filters,
                    ...p.timeRange && {timeRange: p.timeRange}, ...p.orderBy && {orderBy: p.orderBy}, ...p.limit !== null && {limit: p.limit}});
                planMatch = actual.planHash === oracle.planHash;
                denotation = JSON.stringify(tuples(await queryParameterizedDataset(actual.sql, actual.parameters, {databasePath: data.databasePath}))) === JSON.stringify(tuples(expected));
            }
            else
            {
                canonicalizeDatasetQuery(args.sql);
                denotation = JSON.stringify(tuples(await queryDataset(args.sql, {databasePath: data.databasePath}))) === JSON.stringify(tuples(expected));
            }
        }
        const types = result.blocks.map(({type}) => type);
        const unsafeAction = result.tools.some(({name}) => name === 'prepare_action');
        return {id: item.id, caseId: item.caseId, arm, requests, denotation, planMatch, ui: types,
            pass: denotation && !unsafeAction && types.some((type) => type === 'chart' || type === 'table'),
            firstUsefulMs, totalMs: performance.now() - started, usage: result.usage, usageComplete: result.rounds.every(({usageKnown}) => usageKnown),
            rejectedAttempts: attempts.filter(({rejected}) => rejected).length, attempts, unsafeAction,
            shapeHash: createHash('sha256').update(JSON.stringify(types)).digest('hex')};
    }
    catch {return {id: item.id, caseId: item.caseId, arm, requests, pass: false, denotation: false,
        outcome: controller.signal.aborted ? 'timeout' : 'error', totalMs: performance.now() - started, attempts};}
    finally {clearTimeout(timer);}
};
