import type {RouteHandler} from '../core/types.ts';

/**
 * Legacy browser fallback. The HTML entrypoint declares the bundled SVG icon,
 * but some clients still probe `/favicon.ico` before parsing the document.
 */
export const GET: RouteHandler = () =>
    new Response(null, {
        status: 204,
        headers: {'Cache-Control': 'public, max-age=86400'}
    });
