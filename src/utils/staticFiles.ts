import {extname} from 'node:path';
import {containedFile, decodeFilePath} from './files.ts';

const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.txt': 'text/plain',
    '.xml': 'text/xml',
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav'
};

/**
 * Serves static files from the given directory.
 * Returns a Response if the file exists, or null to pass through to routing.
 */
export const serveStatic = async (
    pathname: string,
    publicDir: string,
    ifNoneMatch?: string | null
): Promise<Response | null> =>
{
    const name = decodeFilePath(pathname);
    if (!name) return null;
    const filePath = await containedFile(publicDir, name);
    if (!filePath) return null;
    const file = Bun.file(filePath);
    const ext = extname(name).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

    // HTML is the entrypoint that references fingerprinted assets, so it must be
    // revalidated rather than held for an hour.
    const cacheControl = ext === '.html'
        ? 'public, max-age=0, must-revalidate'
        : 'public, max-age=3600';

    // Weak validator derived from size + mtime - enough for conditional requests
    // without reading the file to hash it.
    const etag = `W/"${file.size.toString(16)}-${Math.floor(file.lastModified).toString(16)}"`;
    const headers: HeadersInit = {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        ETag: etag,
        'Last-Modified': new Date(file.lastModified).toUTCString()
    };

    if (ifNoneMatch?.split(',').some((candidate) => candidate.trim() === etag))
    {
        return new Response(null, {status: 304, headers});
    }

    return new Response(file, {headers});
};
