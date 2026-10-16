import type {DemoRepository} from '../data/types.ts';
import type {ResponsePolicy} from './responsePolicy.ts';
import type {NluiBlock} from './types.ts';

export interface ToolExecution
{
    modelOutput: unknown;
    traceOutput?: unknown;
    responsePolicy?: ResponsePolicy;
    blocks: NluiBlock[];
}

// Server-owned dependencies only, never part of model tool arguments.
export interface ToolDataSource {databasePath: string; repository: DemoRepository;}
export interface ActionIntent {type: 'return_order' | 'cancel_order' | 'update_shipping_address'; orderNumber?: string}
export interface ToolContext {signal?: AbortSignal; data?: ToolDataSource; ownerScope?: string; actionIntent?: ActionIntent | false; conversationId?: string; infographics?: boolean;}

export type ToolHandler = (raw: unknown, context?: ToolContext) => ToolExecution | Promise<ToolExecution>;
