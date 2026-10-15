import {createHash} from 'node:crypto';
import {z} from 'zod';
import manifest from '../../data/fixture-manifest.json';
import {ConversationAccessError, type ConversationStore} from '../conversations/store.ts';
import {DATASET_ID, DATASET_REFERENCE_DATE} from '../data/constants.ts';
import {queryParameterizedDataset} from '../data/queryDataset.ts';
import type {DatasetQueryResult} from '../data/queryTypes.ts';
import {datasetRevision} from '../data/revision.ts';
import {ensureDemoDatabase} from '../data/seed.ts';
import {SEMANTIC_CATALOG_ID, SEMANTIC_CATALOG_VERSION, SEMANTIC_DIMENSION_IDS, SEMANTIC_METRIC_IDS} from '../data/semantic/catalog.ts';
import {type CanonicalSemanticQuery, compileSemanticQuery, SEMANTIC_METRICS} from '../data/semantic/index.ts';
import {semanticFilterSchema, semanticOrderSchema, semanticQuerySchema, semanticTimeRangeSchema} from '../data/semantic/schema.ts';
import {semanticPresentationFor} from '../nlui/semanticPresentation.ts';
import {renderDatasetResult} from '../nlui/toolHandlers/queryDataset.ts';
import type {NluiBlock} from '../nlui/types.ts';

export const planDeltaSchema = z.object({
    metric: z.enum(SEMANTIC_METRIC_IDS).optional(),
    dimensions: z.array(z.enum(SEMANTIC_DIMENSION_IDS)).max(3).optional(),
    filters: z.array(semanticFilterSchema).max(4).optional(),
    timeRange: semanticTimeRangeSchema.nullable().optional(),
    orderBy: semanticOrderSchema.nullable().optional(),
    limit: z.number().int().min(1).max(100).nullable().optional()
}).strict().refine((delta) => Object.keys(delta).length > 0, 'A refinement must change at least one plan field.');
export type PlanDelta = z.infer<typeof planDeltaSchema>;

export interface ArtifactReceipt
{
    planId: string; resultId: string; parentResultId?: string;
    dataset: string; snapshot: string; fixtureFingerprint: string;
    datasetRevisionBefore: string; datasetRevisionAfter: string;
    metric: string; definition: string; formula: string; grain: string; unit: string;
    dimensions: string[]; filters: CanonicalSemanticQuery['filters']; timeRange: CanonicalSemanticQuery['timeRange'];
    orderBy: CanonicalSemanticQuery['orderBy']; limit: number | null;
    rowCount: number; truncated: boolean; warnings: string[]; planHash: string; queryHash: string; resultHash: string;
}
export interface AnalyticalArtifact {plan: CanonicalSemanticQuery; receipt: ArtifactReceipt; result: DatasetQueryResult; sql: string;}

export const receiptMatchesPlan = (plan: CanonicalSemanticQuery, receipt: ArtifactReceipt): boolean =>
    receipt.metric === plan.metric && JSON.stringify(receipt.dimensions) === JSON.stringify(plan.dimensions)
        && JSON.stringify(receipt.filters) === JSON.stringify(plan.filters) && JSON.stringify(receipt.timeRange) === JSON.stringify(plan.timeRange)
        && JSON.stringify(receipt.orderBy) === JSON.stringify(plan.orderBy) && receipt.limit === plan.limit
        && receipt.unit === SEMANTIC_METRICS[plan.metric].unit && receipt.grain === SEMANTIC_METRICS[plan.metric].grain;

export const applyPlanDelta = (plan: CanonicalSemanticQuery, raw: unknown): CanonicalSemanticQuery =>
{
    if (plan.catalogId !== SEMANTIC_CATALOG_ID || plan.catalogVersion !== SEMANTIC_CATALOG_VERSION)
        throw new Error('The analytical catalog changed. Start a new analysis.');
    const delta = planDeltaSchema.parse(raw);
    const combined = {...plan, ...delta};
    return compileSemanticQuery({metric: combined.metric, dimensions: combined.dimensions, filters: combined.filters,
        ...combined.timeRange && {timeRange: combined.timeRange}, ...combined.orderBy && {orderBy: combined.orderBy},
        ...combined.limit !== null && {limit: combined.limit}}).plan;
};

export const artifactFor = (store: ConversationStore, conversation: string, resultId: string): AnalyticalArtifact =>
{
    const record = store.records<AnalyticalArtifact>('artifact', conversation).find(({id}) => id === resultId);
    if (!record) throw new ConversationAccessError();
    if (record.body.receipt.dataset !== DATASET_ID || record.body.receipt.fixtureFingerprint !== manifest.baselineFingerprint
        || record.body.plan.catalogVersion !== SEMANTIC_CATALOG_VERSION)
        throw new ConversationAccessError(409, 'The dataset or catalog changed. Start a new analysis.');
    return record.body;
};

export const executeAnalysis = async ({store, conversation, plan: raw, parentResultId, signal, databasePath}: {
    store: ConversationStore; conversation: string; plan: unknown; parentResultId?: string; signal?: AbortSignal; databasePath?: string;
}): Promise<{artifact: AnalyticalArtifact; blocks: NluiBlock[]}> =>
{
    const plan = semanticQuerySchema.parse(raw);
    const compiled = compileSemanticQuery(plan);
    const ensured = ensureDemoDatabase({databasePath});
    const before = datasetRevision(ensured.databasePath);
    const parent = parentResultId ? artifactFor(store, conversation, parentResultId) : undefined;
    const result = await queryParameterizedDataset(compiled.sql, compiled.parameters, {databasePath: ensured.databasePath, signal});
    const after = datasetRevision(ensured.databasePath);
    const metric = SEMANTIC_METRICS[compiled.plan.metric];
    const receipt: ArtifactReceipt = {
        planId: crypto.randomUUID(), resultId: crypto.randomUUID(), ...parentResultId && {parentResultId},
        dataset: DATASET_ID, snapshot: DATASET_REFERENCE_DATE, fixtureFingerprint: manifest.baselineFingerprint,
        datasetRevisionBefore: before, datasetRevisionAfter: after,
        metric: metric.id, definition: metric.description, formula: metric.expression, grain: metric.grain, unit: metric.unit,
        dimensions: compiled.plan.dimensions, filters: compiled.plan.filters, timeRange: compiled.plan.timeRange,
        orderBy: compiled.plan.orderBy, limit: compiled.plan.limit, rowCount: result.returnedRowCount, truncated: result.truncated,
        warnings: ['Synthetic snapshot; not live production data.', ...result.truncated ? ['Only the first 100 rows are shown.'] : [],
            ...before !== after ? ['Dataset changed during execution. Re-run before comparing results.'] : [],
            ...parent && parent.receipt.datasetRevisionAfter !== before ? ['Dataset changed since the parent result; compare the data revisions before drawing conclusions.'] : [],
            ...metric.id === 'completed_refunds_eur' ? ['Period refers to return request time, not refund payment time.'] : []],
        planHash: compiled.planHash, queryHash: result.queryHash,
        resultHash: createHash('sha256').update(JSON.stringify(result)).digest('hex')
    };
    const artifact: AnalyticalArtifact = {plan: compiled.plan, receipt, result, sql: compiled.sql};
    if (!receiptMatchesPlan(compiled.plan, receipt)) throw new Error('Analytical receipt does not match the applied plan.');
    // Immutable objects: a refinement creates a new identity and keeps its parent.
    store.put('artifact', receipt.resultId, conversation, artifact);
    const rendered = renderDatasetResult(result, metric.label, semanticPresentationFor(compiled.plan, result).presentation);
    return {artifact, blocks: rendered.blocks.map((block) => ({...block, analysis: receipt}))};
};

export const inputPlan = (plan: CanonicalSemanticQuery): unknown => ({metric: plan.metric, dimensions: plan.dimensions,
    filters: plan.filters, ...plan.timeRange && {timeRange: plan.timeRange}, ...plan.orderBy && {orderBy: plan.orderBy},
    ...plan.limit !== null && {limit: plan.limit}});
