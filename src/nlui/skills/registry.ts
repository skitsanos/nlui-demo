import {createHash} from 'node:crypto';
import {z} from 'zod';
import order from './packs/order-investigation/SKILL.md' with {type: 'text'};
import performance from './packs/performance-brief/SKILL.md' with {type: 'text'};
import returns from './packs/returns-explanation/SKILL.md' with {type: 'text'};

export const SKILL_IDS = ['performance-brief', 'order-investigation', 'returns-explanation'] as const;
export type SkillId = typeof SKILL_IDS[number];
export const MAX_SKILL_PACK_BYTES = 4096;
export const skillHash = (text: string): string => createHash('sha256').update(text).digest('hex');
const manifestSchema = z.object({name: z.enum(SKILL_IDS), description: z.string().min(1).max(250),
    metadata: z.object({version: z.string().regex(/^\d+\.\d+\.\d+$/)}).strict()}).strict();

// Reviewed build inputs, not an end-user catalog, writable directory or native provider attachment.
// Changes require an explicit version/hash update and review; structural validity is not approval.
export const SKILL_CATALOG = [
    {id: 'performance-brief', version: '1.0.0',
        description: 'Summarize observed retail performance for a scoped period, with verified metrics and one useful takeaway. Not a forecast or causal diagnosis.',
        contentHash: '2429f296d61c1dd8925939b9b62e12d417f8d7c42072fcc230593f43c06a5f65'},
    {id: 'order-investigation', version: '1.0.0',
        description: 'Investigate one supplied order\'s recorded status and shipment history. Not an action request, refund decision or delivery guarantee.',
        contentHash: '1ae0f4809946b546b9328edef826f07c6fd8b3402ca60203edef0b2b5923f242'},
    {id: 'returns-explanation', version: '1.0.0',
        description: 'Explain the general return policy with its full conditions and evidence. Not a particular order\'s eligibility or an authorized return/refund.',
        contentHash: '52319fc1c636e1488103aa960ef62948af8af78f05330410ed615f63b62f9c5c'}
] as const satisfies readonly {id: SkillId; version: string; description: string; contentHash: string}[];
export type SkillMetadata = {id: SkillId; version: string; description: string; contentHash: string};
export interface ReviewedSkill extends SkillMetadata {instructions: string}
const sources: Record<SkillId, string> = {'performance-brief': performance, 'order-investigation': order, 'returns-explanation': returns};
export const SKILL_CATALOG_HASH = skillHash(JSON.stringify(SKILL_CATALOG));

export const validateReviewedSkill = (source: string, expected: SkillMetadata): ReviewedSkill =>
{
    try
    {
        if (Buffer.byteLength(source) > MAX_SKILL_PACK_BYTES || source.includes('\0') || source.includes('\uFFFD')) throw new Error();
        const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]+)$/);
        if (!match || !match[2]!.trim() || skillHash(source) !== expected.contentHash) throw new Error();
        const manifest = manifestSchema.parse(Bun.YAML.parse(match[1]!));
        if (manifest.name !== expected.id || manifest.description !== expected.description || manifest.metadata.version !== expected.version) throw new Error();
        return {...expected, instructions: match[2]!.trim()};
    }
    catch {throw new Error('Reviewed skill pack is unavailable');}
};
export const readReviewedSkill = (id: SkillId): ReviewedSkill =>
{
    const expected = SKILL_CATALOG.find((skill) => skill.id === id);
    if (!expected) throw new Error('Unknown reviewed skill');
    return validateReviewedSkill(sources[id], expected);
};
