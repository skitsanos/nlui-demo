import type {NluiBlock} from './types.ts';

export interface ToolExecution
{
    modelOutput: unknown;
    blocks: NluiBlock[];
}

export type ToolHandler = (raw: unknown) => ToolExecution | Promise<ToolExecution>;
