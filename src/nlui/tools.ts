import {nluiBlockSchema, nluiBlocksSchema} from './schemas.ts';
import {OPENAI_TOOLS, type QueryArm, toolsForQueryArm} from './toolDefinitions.ts';
import {formHandler, prepareActionHandler} from './toolHandlers/actions.ts';
import {dashboardHandler, ordersHandler} from './toolHandlers/analytics.ts';
import {orderHandler, policiesHandler, productsHandler} from './toolHandlers/catalog.ts';
import {queryDatasetHandler} from './toolHandlers/queryDataset.ts';
import {semanticQueryHandler} from './toolHandlers/semanticQuery.ts';
import {getRepository} from './toolRuntime.ts';
import type {ToolExecution, ToolHandler} from './toolTypes.ts';
import type {NluiBlock} from './types.ts';

export type {ToolExecution} from './toolTypes.ts';
export {OPENAI_TOOLS, type QueryArm, toolsForQueryArm};

const handlers = {
    get_dashboard: dashboardHandler,
    query_dataset: queryDatasetHandler,
    semantic_query: semanticQueryHandler,
    list_orders: ordersHandler,
    search_products: productsHandler,
    get_order: orderHandler,
    search_policies: policiesHandler,
    request_details: formHandler,
    prepare_action: prepareActionHandler
} satisfies Record<string, ToolHandler>;

export const NLUI_TOOL_BLOCK_TYPES = {
    get_dashboard: ['stats', 'chart'],
    query_dataset: ['stats', 'chart', 'table', 'result'],
    semantic_query: ['stats', 'chart', 'table', 'result'],
    list_orders: ['table'],
    search_products: ['choices', 'stats'],
    get_order: ['stats', 'table'],
    search_policies: ['sources'],
    request_details: ['form'],
    prepare_action: ['form', 'confirmation']
} as const satisfies Record<keyof typeof handlers, readonly NluiBlock['type'][]>;

export const executeNluiTool = async (name: string, encodedArguments: string): Promise<ToolExecution> =>
{
    const handler = (handlers as Record<string, ToolHandler>)[name];
    if (!handler)
    {
        throw new Error(`The model requested an unknown tool: ${name}`);
    }

    try
    {
        const execution = await handler(JSON.parse(encodedArguments) as unknown);
        return {
            modelOutput: execution.modelOutput,
            ...execution.traceOutput !== undefined && {traceOutput: execution.traceOutput},
            blocks: nluiBlocksSchema.parse(execution.blocks)
        };
    }
    catch (error)
    {
        return {
            modelOutput: {ok: false, error: error instanceof Error ? error.message : 'Tool execution failed'},
            blocks: []
        };
    }
};

export const confirmNluiAction = (actionId: string): ToolExecution =>
{
    const result = getRepository().confirmAction(actionId);
    const block: NluiBlock = {
        id: crypto.randomUUID(),
        type: 'result',
        status: 'success',
        title: 'Action completed',
        message: result.message
    };
    return {modelOutput: result, blocks: [nluiBlockSchema.parse(block)]};
};
