import {z} from 'zod';
import {applyPlanDelta, artifactFor, executeAnalysis, inputPlan, planDeltaSchema} from '../../analysis/artifacts.ts';
import {conversationSession} from '../../conversations/session.ts';
import {ConversationAccessError, getConversationStore} from '../../conversations/store.ts';
import config from '../../core/configuration.ts';
import type {RouteHandler} from '../../core/types.ts';
import {SEMANTIC_METRICS} from '../../data/semantic/catalog.ts';
import {semanticQuerySchema} from '../../data/semantic/schema.ts';
import {createRequestDeadline, readRequestJson} from '../../server/requestDeadline.ts';

export const analysisRequestSchema = z.object({
    conversationId: z.string().min(12).max(120), requestId: z.string().min(12).max(120).regex(/^[a-zA-Z0-9_-]+$/), previousResponseId: z.string().max(120).optional(),
    plan: semanticQuerySchema.optional(), parentResultId: z.string().uuid().optional(), delta: planDeltaSchema.optional()
}).strict().refine((body) => body.parentResultId ? !!body.delta && !body.plan : !!body.plan && !body.delta,
    'Provide an initial plan or an exact parent result and typed delta.');

export const POST: RouteHandler = async ({req}) =>
{
    const deadline = createRequestDeadline(req.signal, 10_000);
    let active: {conversation: string; request: string} | undefined;
    try
    {
        const store = getConversationStore();
        const {owner, headers} = conversationSession(req, store);
        const body = analysisRequestSchema.parse(await readRequestJson(req, deadline.signal, config.server.maxRequestBodySize));
        if (body.parentResultId) store.assertOwner(owner, body.conversationId);
        const parent = body.parentResultId ? artifactFor(store, body.conversationId, body.parentResultId) : undefined;
        const canonical = parent ? applyPlanDelta(parent.plan, body.delta) : undefined;
        const plan = canonical ? inputPlan(canonical) : body.plan;
        const input = {type: 'user_text' as const, text: JSON.stringify({analysis: plan, parentResultId: body.parentResultId})};
        const definition = semanticQuerySchema.parse(plan);
        const display = `${parent ? 'Refine' : 'Analyze'} ${SEMANTIC_METRICS[definition.metric].label.toLowerCase()}${definition.dimensions.length ? ` by ${definition.dimensions.join(', ').replaceAll('_', ' ')}` : ''}`;
        if (store.begin(owner, body.conversationId, body.requestId, input, body.previousResponseId, display) === 'replay')
            return Response.json({replayed: true}, {headers});
        active = {conversation: body.conversationId, request: body.requestId};
        const {artifact, blocks} = await executeAnalysis({store, conversation: body.conversationId, plan,
            parentResultId: body.parentResultId, signal: deadline.signal});
        deadline.check();
        const emit = (event: Parameters<typeof store.append>[2]) => store.append(body.conversationId, body.requestId, event);
        emit({type: 'message.started', messageId: body.requestId});
        emit({type: 'text.delta', delta: parent
            ? 'I applied your changes to this result. The provenance receipt shows the exact scope so you can check the comparison.'
            : 'Here’s the dataset view you requested. You can refine its scope directly; each change keeps a separate, traceable result.'});
        for (const block of blocks) emit({type: 'ui.block', block});
        emit({type: 'message.completed', messageId: body.requestId, responseId: body.requestId});
        return Response.json({receipt: artifact.receipt}, {headers});
    }
    catch (error)
    {
        if (active) getConversationStore().interrupt(active.conversation, active.request);
        return Response.json({message: error instanceof ConversationAccessError ? error.message : 'The analytical scope is invalid or unavailable.'},
            {status: error instanceof ConversationAccessError ? error.status : 400});
    }
    finally {deadline.dispose();}
};

export const GET: RouteHandler = ({req}) =>
{
    try
    {
        const store = getConversationStore(); const {owner, headers} = conversationSession(req, store);
        const url = new URL(req.url); const conversation = url.searchParams.get('conversationId') ?? '';
        store.assertOwner(owner, conversation);
        const artifact = artifactFor(store, conversation, url.searchParams.get('resultId') ?? '');
        // SQL is only returned by an explicit, owner-scoped debug request.
        return Response.json(url.searchParams.get('debug') === 'sql' ? {sql: artifact.sql, receipt: artifact.receipt} : {receipt: artifact.receipt}, {headers});
    }
    catch {return Response.json({message: 'Result not found.'}, {status: 404});}
};
