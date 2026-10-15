export const UNSUPPORTED_REFERENCE_IDS = new Set(['products-laptop-travel', 'products-compare-laptops', 'products-design-monitor',
    'products-office-bundle', 'policy-address-change', 'action-cancel-delivered-refusal', 'disambiguation-order']);

export const verifyReferenceProfile = (encoded: string): void =>
{
    const output = JSON.parse(encoded);
    const results = output.reports?.flatMap((report: {results: unknown[]}) => report.results);
    if (output.kind !== 'provider-free-reference' || !Array.isArray(results) || results.length !== 35
        || new Set(results.map(({scenarioId}) => scenarioId)).size !== 35
        || results.filter(({status}) => status === 'passed').length !== 28
        || results.filter(({status}) => status === 'incomplete').length !== 7
        || results.some(({status, scenarioId}) => status !== (UNSUPPORTED_REFERENCE_IDS.has(scenarioId) ? 'incomplete' : 'passed')))
    {
        throw new Error('Unexpected provider-free reference profile; incomplete cases are not passing model evaluations');
    }
};
