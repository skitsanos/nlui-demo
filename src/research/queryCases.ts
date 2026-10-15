import type {SemanticQuery} from '../data/semantic/schema.ts';

export interface ResearchQueryCase {id: string; caseId: string; prompt: string; plan: SemanticQuery}
const period = {from: '2026-06-01', to: '2026-06-30'};
export const RESEARCH_QUERY_CASES: ResearchQueryCase[] = [
    {id: 'merchandise-explicit', caseId: 'merchandise',
        prompt: 'Show gross merchandise revenue by product category for June 2026, before order discount, tax and shipping, excluding cancelled and returned orders.',
        plan: {metric: 'merchandise_revenue_eur', dimensions: ['product_category'], filters: [], timeRange: period}},
    {id: 'merchandise-paraphrase', caseId: 'merchandise',
        prompt: 'Compare June 2026 line-item sales across merchandise categories. Use gross item value, not order totals; do not count cancelled or returned orders.',
        plan: {metric: 'merchandise_revenue_eur', dimensions: ['product_category'], filters: [], timeRange: period}},
    {id: 'refunds-explicit', caseId: 'refunds',
        prompt: 'Compare completed refund amounts by region for returns requested in June 2026. Exclude all still-pending returns and use request date, not order date.',
        plan: {metric: 'completed_refunds_eur', dimensions: ['region'], filters: [], timeRange: period}},
    {id: 'refunds-paraphrase', caseId: 'refunds',
        prompt: 'How much money was returned to customers in each region for June 2026 return requests? Count only completed returns; June means when the return was requested.',
        plan: {metric: 'completed_refunds_eur', dimensions: ['region'], filters: [], timeRange: period}}
];
export const RESEARCH_QUERY_ARMS = ['fixed', 'control', 'semantic', 'hybrid'] as const;
export type ResearchQueryArm = typeof RESEARCH_QUERY_ARMS[number];
