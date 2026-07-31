import type {NluiBlock} from './types.ts';

export interface ToolExecution
{
    modelOutput: unknown;
    traceOutput?: unknown;
    blocks: NluiBlock[];
}

export type ToolHandler = (raw: unknown) => ToolExecution | Promise<ToolExecution>;
