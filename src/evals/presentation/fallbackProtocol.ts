import {z} from 'zod';
import type {MatchedPresentation} from './benchmark.ts';
import {REPRESENTATIONS} from './cases.ts';
import {FALLBACK_CONTRACT_VERSION, FALLBACK_INSTRUCTIONS, FALLBACK_RULES, type FallbackArm, type FallbackContext, fallbackCatalog, fallbackDecision} from './fallbackContract.ts';
import {FALLBACK_FIXTURES} from './fallbackFixtures.ts';
import {gradePresentation} from './grade.ts';
import {selectionInput} from './liveProtocol.ts';
import {evidenceHash} from './oracle.ts';
import type {PresentationSelection} from './selection.ts';

const choiceSchema = z.object({representation: z.enum(REPRESENTATIONS)}).strict();
export const fallbackChoiceSchema = (arm: FallbackArm) => ({type: 'object', properties: {
    representation: {type: 'string', enum: fallbackCatalog(arm).map(({kind}) => kind)}
}, required: ['representation'], additionalProperties: false});

// Offline prompt material only: no client, credentials, budget, transport or billable entrypoint.
// Share the original raw verified inputs, never the hand-labelled fallback contexts or answers.
export const fallbackPrompt = (pair: MatchedPresentation, arm: FallbackArm) => ({
    instructions: FALLBACK_INSTRUCTIONS, input: {...selectionInput(pair), catalog: fallbackCatalog(arm)},
    schema: fallbackChoiceSchema(arm)
});
export const fallbackProtocolFingerprint = () => evidenceHash({version: FALLBACK_CONTRACT_VERSION,
    instructions: FALLBACK_INSTRUCTIONS, rules: FALLBACK_RULES, fixtures: FALLBACK_FIXTURES,
    catalogs: ['baseline', 'candidate'].map((arm) => fallbackCatalog(arm as FallbackArm)),
    schemas: ['baseline', 'candidate'].map((arm) => fallbackChoiceSchema(arm as FallbackArm))});

export const gradeFallbackChoice = (pair: MatchedPresentation, context: FallbackContext, arm: FallbackArm,
    encoded: string, descriptors: PresentationSelection[] = [pair.baseline, pair.candidate]) =>
{
    try
    {
        const {representation} = choiceSchema.parse(JSON.parse(encoded));
        if (!fallbackCatalog(arm).some(({kind}) => kind === representation)) return {passed: false, errors: ['outside_arm_catalog']};
        if (!fallbackDecision(context, arm).eligible.includes(representation)) return {passed: false, errors: ['ineligible_representation']};
        const selected = descriptors.find((item) => item.representation === representation);
        if (!selected) return {passed: false, errors: ['unavailable_descriptor']};
        // Reuse the frozen independent content grader without changing v1 labels or scoring.
        const task = {...pair.task, baseline: fallbackDecision(context, 'baseline').preferred,
            candidate: fallbackDecision(context, 'candidate').preferred};
        return gradePresentation(task, pair.evidence, selected, arm);
    }
    catch {return {passed: false, errors: ['invalid_choice_or_contract']};}
};
