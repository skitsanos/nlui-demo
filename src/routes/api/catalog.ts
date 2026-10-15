import type {RouteHandler} from '../../core/types.ts';
import {semanticCatalogMarkdown, semanticCatalogMetadata} from '../../data/semantic/metadata.ts';

export const GET: RouteHandler = ({req}) => new URL(req.url).searchParams.get('format') === 'markdown'
    ? new Response(semanticCatalogMarkdown(), {headers: {'Content-Type': 'text/markdown; charset=utf-8'}})
    : Response.json(semanticCatalogMetadata());
