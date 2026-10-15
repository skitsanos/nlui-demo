import type {DemoRepository} from '../data/types.ts';
import type {NluiBlock} from './types.ts';

export interface ToolExecution
{
    modelOutput: unknown;
    traceOutput?: unknown;
    blocks: NluiBlock[];
}

// Server-owned dependencies only, never part of model tool arguments.
export interface ToolDataSource {databasePath: string; repository: DemoRepository;}
export interface ToolContext {signal?: AbortSignal; data?: ToolDataSource;}

export type ToolHandler = (raw: unknown, context?: ToolContext) => ToolExecution | Promise<ToolExecution>;
