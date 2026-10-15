import {conversationSession} from '../../../conversations/session.ts';
import {ConversationAccessError, getConversationStore} from '../../../conversations/store.ts';
import type {RouteHandler} from '../../../core/types.ts';
import {inspectDatasetUpload} from '../../../onboarding/preview.ts';
import {abortable, createRequestDeadline, RequestBodyTooLargeError, readRequestBytes } from '../../../server/requestDeadline.ts';

export const POST: RouteHandler = async ({req}) =>
{
    const deadline = createRequestDeadline(req.signal, 10_000);
    try
    {
        const store = getConversationStore(); const {owner, headers} = conversationSession(req, store);
        if (!req.headers.get('Content-Type')?.startsWith('multipart/form-data')) return Response.json({message: 'Expected a CSV multipart upload.'}, {status: 415});
        if (Number(req.headers.get('Content-Length') ?? 0) > 300 * 1024) return Response.json({message: 'Preview upload is too large.'}, {status: 413});
        const bytes = await readRequestBytes(req, deadline.signal, 300 * 1024);
        const form = await new Response(bytes, {headers: {'Content-Type': req.headers.get('Content-Type')!}}).formData();
        const file = form.get('file');
        if (!(file instanceof File) || [...form.keys()].length !== 1 || file.size > 256 * 1024 || !file.name.toLowerCase().endsWith('.csv'))
            return Response.json({message: 'Provide one CSV file under 256 KiB.'}, {status: 400});
        const text = new TextDecoder('utf-8', {fatal: true}).decode(await abortable(() => file.arrayBuffer(), deadline.signal));
        const preview = inspectDatasetUpload(text);
        const count = store.records('dataset-preview', owner).length;
        if (count >= 10) return Response.json({message: 'The local session preview limit was reached.'}, {status: 429});
        store.put('dataset-preview', preview.id, owner, preview);
        return Response.json(preview, {headers});
    }
    catch (error)
    {
        return Response.json({message: error instanceof ConversationAccessError ? error.message : 'The file does not match the approved CSV template. No data was activated.'},
            {status: error instanceof ConversationAccessError ? error.status : error instanceof RequestBodyTooLargeError ? 413 : 400});
    }
    finally {deadline.dispose();}
};

export const GET: RouteHandler = ({req}) =>
{
    try
    {
        const store = getConversationStore(); const {owner, headers} = conversationSession(req, store);
        const id = new URL(req.url).searchParams.get('id');
        const record = store.records('dataset-preview', owner).find((entry) => entry.id === id);
        return record ? Response.json(record.body, {headers}) : Response.json({message: 'Preview not found.'}, {status: 404, headers});
    }
    catch {return Response.json({message: 'Preview not found.'}, {status: 404});}
};
