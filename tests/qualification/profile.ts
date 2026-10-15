import {REFERENCE_IDS} from '../../scripts/qualification/reference.ts';
import {evaluationVersions} from '../../src/evals/reportAccounting.ts';

export const referenceOutput = () => JSON.stringify({kind: 'provider-free-reference', reports: [{versions: evaluationVersions(),
    results: REFERENCE_IDS.map((scenarioId) => ({scenarioId, status: 'passed'}))}]});
