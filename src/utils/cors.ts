import type {CorsConfig} from '../core/configuration.ts';

const headerToken = /^[A-Za-z0-9!#$%&'*+.^_|\x60~-]+$/;
const originAllowed = (origin: string, cors: CorsConfig): boolean =>
    cors.allowedOrigins.includes('*') || cors.allowedOrigins.includes(origin);

export const appendVary = (headers: Headers, ...names: string[]): void =>
{
    const current = (headers.get('Vary') ?? '').split(',').map((name) => name.trim()).filter(Boolean);
    if (current.includes('*')) return;
    for (const name of names) if (!current.some((value) => value.toLowerCase() === name.toLowerCase())) current.push(name);
    if (current.length) headers.set('Vary', current.join(', '));
};

export const isCorsPreflight = (request: Request): boolean => request.method === 'OPTIONS'
    && !!request.headers.get('Origin') && request.headers.has('Access-Control-Request-Method');

/** Call only after resolving a real route/static resource, never as a global OPTIONS shortcut. */
export const handleCors = (request: Request, cors: CorsConfig | undefined, routeMethods: readonly string[]): Response | null =>
{
    if (!cors?.enabled || !isCorsPreflight(request)) return null;
    const headers = new Headers();
    appendVary(headers, 'Origin', 'Access-Control-Request-Method', 'Access-Control-Request-Headers');
    const methods = routeMethods.filter((method) => cors.allowedMethods.some((allowed) => allowed.toUpperCase() === method));
    headers.set('Allow', routeMethods.join(', '));
    const origin = request.headers.get('Origin')!;
    const method = request.headers.get('Access-Control-Request-Method')!.trim();
    const rawHeaders = request.headers.get('Access-Control-Request-Headers');
    const requested = rawHeaders === null ? [] : rawHeaders.split(',').map((name) => name.trim());
    if (!headerToken.test(method) || requested.some((name) => !headerToken.test(name)))
        return new Response('Malformed preflight', {status: 400, headers});
    if (!originAllowed(origin, cors)) return new Response('Origin not allowed', {status: 403, headers});
    if (!methods.includes(method)) return new Response('Method not allowed', {status: 405, headers});
    const allowed = new Set(cors.allowedHeaders.map((name) => name.toLowerCase()));
    if (requested.some((name) => !allowed.has(name.toLowerCase()) && !(allowed.has('*') && !cors.allowCredentials
        && name.toLowerCase() !== 'authorization'))) return new Response('Headers not allowed', {status: 403, headers});
    headers.set('Access-Control-Allow-Methods', methods.join(', '));
    if (requested.length) headers.set('Access-Control-Allow-Headers', [...new Set(requested.map((name) => name.toLowerCase()))].join(', '));
    if (cors.maxAge > 0) headers.set('Access-Control-Max-Age', String(cors.maxAge));
    const response = new Response(null, {status: 204, headers});
    applyCorsHeaders(response, request, cors);
    return response;
};

export const applyCorsHeaders = (response: Response, request: Request, cors?: CorsConfig): void =>
{
    if (!cors?.enabled) return;
    const wildcard = cors.allowedOrigins.includes('*') && !cors.allowCredentials;
    if (!wildcard) appendVary(response.headers, 'Origin');
    const origin = request.headers.get('Origin');
    if (!wildcard && (!origin || !originAllowed(origin, cors)))
    {
        for (const header of ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials', 'Access-Control-Allow-Methods', 'Access-Control-Allow-Headers'])
            response.headers.delete(header);
        return;
    }
    response.headers.set('Access-Control-Allow-Origin', wildcard ? '*' : origin!);
    if (cors.allowCredentials) response.headers.set('Access-Control-Allow-Credentials', 'true');
    if (cors.exposedHeaders.length) response.headers.set('Access-Control-Expose-Headers', cors.exposedHeaders.join(', '));
};
