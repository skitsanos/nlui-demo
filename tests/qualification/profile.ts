import {UNSUPPORTED_REFERENCE_IDS} from '../../scripts/qualification/reference.ts';

export const referenceOutput = () => JSON.stringify({kind: 'provider-free-reference', reports: [{results: [
    ...Array.from({length: 28}, (_, index) => ({scenarioId: `reference-${index}`, status: 'passed'})),
    ...[...UNSUPPORTED_REFERENCE_IDS].map((scenarioId) => ({scenarioId, status: 'incomplete'}))
]}]});
