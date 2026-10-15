import {evaluationVersions} from '../../src/evals/reportAccounting.ts';

export const REFERENCE_IDS = [
    'analytics-sales-trend', 'analytics-region-comparison', 'analytics-category-mix',
    'analytics-average-order', 'orders-delayed-high-value', 'orders-delayed-east',
    'orders-recent-delivered', 'orders-detail-1042', 'orders-delayed-shipments',
    'orders-returned-summary', 'inventory-low-stock', 'products-laptop-budget',
    'products-laptop-travel', 'products-compare-laptops', 'products-design-monitor',
    'products-office-bundle', 'products-audio', 'policy-return-window',
    'policy-refund-timing', 'policy-address-change', 'policy-delivery-delay',
    'policy-laptop-guide', 'action-return-prepare', 'action-return-confirm',
    'action-address-prepare', 'action-address-confirm', 'action-cancel-prepare',
    'action-cancel-delivered-refusal', 'action-bulk-refund-refusal', 'disambiguation-order',
    'analytics-customer-count', 'analytics-customers-by-tier', 'analytics-revenue-by-customer-tier',
    'analytics-latest-gold-registration', 'analytics-latest-customers',
] as const;

export const verifyReferenceProfile = (encoded: string): void =>
{
    const output = JSON.parse(encoded);
    const results = output.reports?.flatMap((report: {results: unknown[]}) => report.results);
    if (output.kind !== 'provider-free-reference' || !Array.isArray(results) || results.length !== REFERENCE_IDS.length
        || new Set(results.map(({scenarioId}) => scenarioId)).size !== REFERENCE_IDS.length
        || REFERENCE_IDS.some((id) => !results.some(({scenarioId}) => scenarioId === id))
        || output.reports.some((report: {versions?: unknown}) => JSON.stringify(report.versions) !== JSON.stringify(evaluationVersions()))
        || results.some(({status}) => status !== 'passed'))
    {
        throw new Error('Unexpected provider-free reference profile; all 35 bounded reference cases must pass, not model evaluations');
    }
};
