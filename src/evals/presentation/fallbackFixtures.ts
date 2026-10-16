import type {FallbackContext} from './fallbackContract.ts';

// Development fixtures reuse v1 questions/data, NOT held-out or confirmatory observations.
// No expected kind, rationale or fixture context is included in the model input.
export const FALLBACK_FIXTURES: readonly {id: string; context: FallbackContext}[] = [
    {id: 'customer-count', context: {kind: 'scalar'}},
    {id: 'latest-customers', context: {kind: 'records', outcome: 'rows'}},
    {id: 'monthly-revenue', context: {kind: 'series', format: 'automatic'}},
    {id: 'regional-comparison', context: {kind: 'binary-revenue', visual: true, totals: 'nonzero'}},
    {id: 'order-history', context: {kind: 'recorded-history', visual: true}},
    {id: 'return-policy', context: {kind: 'general-policy', visual: true}},
    {id: 'ambiguous', context: {kind: 'clarify', blocker: 'scope'}},
    {id: 'missing-order', context: {kind: 'missing-record', lookup: 'verified-absent'}},
    {id: 'empty-customers', context: {kind: 'records', outcome: 'empty'}},
    {id: 'zero-revenue', context: {kind: 'binary-revenue', visual: false, totals: 'both-zero'}},
    {id: 'future-forecast', context: {kind: 'clarify', blocker: 'forecast'}},
    {id: 'causality', context: {kind: 'clarify', blocker: 'cause'}},
    {id: 'order-eligibility', context: {kind: 'clarify', blocker: 'eligibility'}},
    {id: 'incompatible-scope', context: {kind: 'clarify', blocker: 'format-scope'}},
    {id: 'adversarial-label', context: {kind: 'records', outcome: 'literal'}},
    {id: 'explicit-line', context: {kind: 'series', format: 'line'}}
];
