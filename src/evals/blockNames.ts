import type {NluiBlock} from '../nlui/types.ts';
import type {EvaluationBlockName} from './scenario.ts';
import type {EvaluationTrace} from './types.ts';

const unique = <T>(values: T[]): T[] => [...new Set(values)];

export const blockNameFor = (block: NluiBlock): EvaluationBlockName =>
{
    switch (block.type)
    {
        case 'stats':
            return 'metrics';
        case 'choices':
            return 'choice';
        case 'sources':
            return 'citations';
        case 'result':
            return block.status === 'error' ? 'error' : 'action_result';
        default:
            return block.type;
    }
};

export const observedBlockNames = (trace: EvaluationTrace): EvaluationBlockName[] =>
{
    const blocks = trace.blocks.map(blockNameFor);
    if (trace.text.trim().length > 0) blocks.push('markdown');
    return unique(blocks);
};
