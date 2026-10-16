import {executeNluiTool} from '../../nlui/tools.ts';
import type {ToolDataSource} from '../../nlui/toolTypes.ts';
import type {NluiBlock} from '../../nlui/types.ts';
import type {PresentationCase, Representation} from './cases.ts';
import type {PresentationEvidence} from './oracle.ts';

export interface PresentationSelection
{
    representation: Representation;
    caption: string;
    context: Omit<PresentationEvidence, 'columns' | 'rows'>;
    blocks: NluiBlock[];
}
export const controlledSelection = (item: PresentationCase, evidence: PresentationEvidence): PresentationSelection =>
{
    const {columns, rows, ...context} = evidence;
    const base = {id: `${item.id}-control`, title: item.prompt};
    const representation = item.baseline;
    const blocks: NluiBlock[] = [];
    if (representation === 'stats') blocks.push({...base, type: 'stats', items: rows.map((row) => ({label: String(row.label), value: Number(row.value), format: 'number'}))});
    if (representation === 'table') blocks.push({...base, type: 'table', columns: structuredClone(columns),
        rows: rows.map((row, index) => ({...row, _row: index})), rowKey: '_row'});
    if (representation === 'chart') blocks.push({...base, type: 'chart', variant: item.id === 'regional-comparison' ? 'bar' : 'line',
        categoryKey: 'label', valueKey: 'value', valueLabel: 'Revenue (EUR)',
        ...item.id !== 'regional-comparison' && {categoryFormat: 'date' as const}, data: rows.map(({label, value}) => ({label: String(label), value: Number(value)}))});
    if (representation === 'sources') blocks.push({...base, type: 'sources', items: rows.map((row) => ({title: String(row.label), excerpt: String(row.detail), source: context.source}))});
    if (representation === 'result') blocks.push({...base, type: 'result', status: 'info', message: item.caption});
    return {representation, caption: item.caption, context, blocks};
};

// This is an authored reference adapter, not the application's intent router or a model prediction.
export const candidateSelection = async (item: PresentationCase, evidence: PresentationEvidence, data: ToolDataSource): Promise<PresentationSelection> =>
{
    const control = controlledSelection(item, evidence);
    if (!item.candidate.startsWith('infographic:')) return control;
    const view = item.candidate.split(':')[1];
    const execution = await executeNluiTool('get_infographic', JSON.stringify({view,
        regions: view === 'comparison' ? ['West', 'East'] : [], from: view === 'comparison' ? '2026-01-01' : null,
        to: view === 'comparison' ? '2026-06-30' : null, order_number: view === 'timeline' ? 'ORD-1042' : null}),
    undefined, data, {infographics: true});
    return {...control, representation: item.candidate, blocks: execution.blocks};
};
