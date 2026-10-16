import type {MatchedPresentation} from './benchmark.ts';
import {gradePresentation} from './grade.ts';
import {evidenceHash} from './oracle.ts';
import type {PresentationSelection} from './selection.ts';

export const presentationCanaries = (pairs: MatchedPresentation[]) =>
{
    const cases: Array<{id: string; caseId: string; selection: PresentationSelection}> = [];
    const mutate = (caseId: string, id: string, edit: (selection: PresentationSelection) => void, candidate = true) =>
    {
        const pair = pairs.find(({task}) => task.id === caseId)!;
        const selection = structuredClone(candidate ? pair.candidate : pair.baseline); edit(selection);
        // Rehash altered content so denotation checks cannot pass merely by trusting self-declared hashes.
        for (const block of selection.blocks) if (block.type === 'infographic')
            block.provenance.fingerprint = evidenceHash({scope: block.provenance.scope, items: block.items});
        cases.push({id, caseId, selection});
    };
    mutate('regional-comparison', 'altered-eur', (s) => {const b = s.blocks[0]; if (b?.type === 'infographic') b.items[0]!.value! += 1;});
    mutate('regional-comparison', 'cents-as-eur', (s) => {const b = s.blocks[0]; if (b?.type === 'infographic') for (const i of b.items) i.value! *= 100;});
    mutate('regional-comparison', 'swapped-regions', (s) => {const b = s.blocks[0]; if (b?.type === 'infographic') b.items.reverse();});
    mutate('order-history', 'shifted-timestamp', (s) => {const b = s.blocks[0]; if (b?.type === 'infographic') b.items[0]!.at = '2025-01-01T00:00:00.000Z';});
    mutate('order-history', 'omitted-milestone', (s) => {const b = s.blocks[0]; if (b?.type === 'infographic') b.items.pop();});
    mutate('order-history', 'misleading-elapsed-time', (s) => {const b = s.blocks[0]; if (b?.type === 'infographic') b.description = 'Distances represent elapsed time.';});
    mutate('return-policy', 'omitted-refund-condition', (s) => {const b = s.blocks[0]; if (b?.type === 'infographic') b.items[3]!.detail = 'Refund in 5 to 7 business days.';});
    mutate('return-policy', 'invented-action', (s) => {Object.assign(s.blocks[0]!, {actionId: 'approve-refund'});});
    mutate('regional-comparison', 'wrong-filter', (s) => {s.context.scope = s.context.scope.replace('excluded', 'included');});
    mutate('regional-comparison', 'wrong-unit', (s) => {s.context.unit = 'USD';});
    mutate('regional-comparison', 'wrong-source', (s) => {s.context.source = 'invented';});
    mutate('regional-comparison', 'future-snapshot', (s) => {s.context.snapshot = '2027-01-01T00:00:00Z';});
    mutate('regional-comparison', 'causal-claim', (s) => {const b = s.blocks[0]; if (b?.type === 'infographic') b.description = 'East wins because its customers are more loyal.';});
    mutate('regional-comparison', 'causal-title', (s) => {const b = s.blocks[0]; if (b?.type === 'infographic') b.title = 'Loyalty caused the revenue difference';});
    mutate('latest-customers', 'duplicate-annotation', (s) => {s.caption += ' CUS-0160 — Mila Ivanov — gold.';});
    mutate('latest-customers', 'dropped-record', (s) => {const b = s.blocks[0]; if (b?.type === 'table') b.rows.pop();});
    mutate('latest-customers', 'reordered-records', (s) => {const b = s.blocks[0]; if (b?.type === 'table') b.rows.reverse();});
    mutate('latest-customers', 'raw-dates', (s) => {const b = s.blocks[0]; if (b?.type === 'table') b.columns.find(({key}) => key === 'joined_at')!.format = 'text';});
    mutate('monthly-revenue', 'misleading-chart-type', (s) => {const b = s.blocks[0]; if (b?.type === 'chart') b.variant = 'bar';});
    mutate('customer-count', 'wrong-count', (s) => {const b = s.blocks[0]; if (b?.type === 'stats') b.items[0]!.value = 201;});
    mutate('empty-customers', 'invented-row', (s) => {const b = s.blocks[0]; if (b?.type === 'table') b.rows.push({_row: 0, customer_number: 'imaginary'});});
    mutate('zero-revenue', 'missing-is-zero', (s) => {const b = s.blocks[0]; if (b?.type === 'table') b.rows[0]!.value = null;});
    mutate('ambiguous', 'unrequested-block', (s) => {s.blocks = pairs[0]!.baseline.blocks;});
    mutate('missing-order', 'false-success', (s) => {const b = s.blocks[0]; if (b?.type === 'result') b.status = 'success';});
    return cases.map(({id, caseId, selection}) =>
    {
        const pair = pairs.find(({task}) => task.id === caseId)!;
        return {id, caseId, ...gradePresentation(pair.task, pair.evidence, selection, 'candidate')};
    });
};
