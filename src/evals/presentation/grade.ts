import {isDeepStrictEqual} from 'node:util';
import {infographicBlockSchema} from '../../nlui/infographic/schema.ts';
import {nluiBlocksSchema} from '../../nlui/schemas.ts';
import type {NluiBlock} from '../../nlui/types.ts';
import type {PresentationCase, Representation} from './cases.ts';
import {evidenceHash, type PresentationEvidence} from './oracle.ts';
import type {PresentationSelection} from './selection.ts';

const same = isDeepStrictEqual;
export const eligibleRepresentations = (item: PresentationCase, arm: 'baseline' | 'candidate'): Representation[] =>
    arm === 'baseline' || item.baseline === item.candidate ? [item.baseline] : [item.baseline, item.candidate];

const projection = (block: NluiBlock, evidence: PresentationEvidence): unknown =>
{
    if (block.type === 'stats') return block.items.every((item) => item.format === 'number' && !item.suffix && !item.trend)
        ? block.items.map(({label, value}) => ({label, value})) : null;
    if (block.type === 'chart')
    {
        const monthly = evidence.source === 'dataset:monthly-revenue';
        if (block.variant !== (monthly ? 'line' : 'bar') || block.categoryKey !== 'label' || block.valueKey !== 'value'
            || block.valueLabel !== 'Revenue (EUR)' || block.categoryFormat !== (monthly ? 'date' : undefined)) return null;
        return block.data;
    }
    if (block.type === 'table') return same(block.columns, evidence.columns)
        ? block.rows.map((row) => Object.fromEntries(evidence.columns.map(({key}) => [key, row[key]]))) : null;
    if (block.type === 'sources') return block.items.every(({source}) => source === evidence.source)
        ? block.items.map(({title, excerpt}) => ({label: title, detail: excerpt})) : null;
    if (block.type === 'infographic')
    {
        const parsed = infographicBlockSchema.safeParse(block);
        if (!parsed.success || block.snapshot !== evidence.snapshot || block.provenance.scope !== evidence.scope
            || block.provenance.source !== evidence.source
            || block.provenance.fingerprint !== evidenceHash({scope: evidence.scope, items: block.items})) return null;
        const warning = block.view === 'timeline' ? 'Only recorded events are shown. Missing milestones are unknown. Spacing shows sequence, not elapsed time.'
            : block.view === 'comparison' ? 'An exact side-by-side comparison, not an explanation of why the regions differ.'
                : 'This explains the policy, not the status or eligibility of a particular order. Nothing is submitted.';
        if (block.description !== warning) return null;
        const title = block.view === 'comparison' ? 'West and East revenue'
            : block.view === 'timeline' ? 'ORD-1042 recorded history' : 'How returns work';
        if (block.title !== title) return null;
        if (block.view === 'comparison') return block.items.every(({detail}) => detail === 'Eligible order revenue · EUR')
            ? block.items.map(({label, value}) => ({label, value})) : null;
        return block.items.map(({label, at, detail}) => block.view === 'timeline' ? {label, at, detail} : {label, detail});
    }
    return [];
};

// Grades frozen contracts and exact denotation. It is deliberately NOT a general language/comprehension judge.
export const gradePresentation = (item: PresentationCase, evidence: PresentationEvidence, selection: PresentationSelection, arm: 'baseline' | 'candidate') =>
{
    const errors: string[] = [];
    if (!eligibleRepresentations(item, arm).includes(selection.representation)) errors.push('ineligible_representation');
    const {columns: _columns, rows: _rows, ...context} = evidence;
    if (!same(context, selection.context)) errors.push('scope_unit_source_snapshot');
    if (selection.caption !== item.caption) errors.push('annotation_contract');
    const parsed = nluiBlocksSchema.safeParse(selection.blocks);
    if (!parsed.success) errors.push('invalid_blocks');
    else if (selection.representation === 'message')
    {
        if (parsed.data.length || evidence.rows.length) errors.push('message_hides_evidence');
    }
    else
    {
        const block = parsed.data[0];
        if (block && block.type !== 'infographic' && block.title !== item.prompt) errors.push('title_contract');
        const observed = block?.type === 'infographic' ? `infographic:${block.view}` : block?.type;
        if (parsed.data.length !== 1 || observed !== selection.representation) errors.push('block_selection');
        if (block?.type === 'result')
        {
            if (evidence.rows.length || block.status !== 'info' || block.message !== item.caption) errors.push('result_contract');
        }
        else if (!block || !same(projection(block, evidence), evidence.rows)) errors.push('denotation_or_semantics');
    }
    return {passed: errors.length === 0, errors};
};
