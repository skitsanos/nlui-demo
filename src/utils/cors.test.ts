import {describe, expect, test} from 'bun:test';
import {type CorsConfig, corsSchema} from '../core/configuration.ts';
import {getAllowedMethods} from '../server/routing.ts';
import {appendVary, applyCorsHeaders, handleCors, isCorsPreflight} from './cors.ts';

const policy: CorsConfig = {enabled: true, allowedOrigins: ['https://allowed.example'],
    allowedMethods: ['GET', 'HEAD', 'POST', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Response-Time'], allowCredentials: false, maxAge: 600};
const request = (headers: Record<string, string> = {}, method = 'OPTIONS') => new Request('http://localhost/api/health', {
    method, headers: {Origin: 'https://allowed.example', 'Access-Control-Request-Method': 'GET', ...headers}
});

describe('route-aware CORS', () =>
{
    test('intersects actual route methods with policy, without running a handler', () =>
    {
        const response = handleCors(request(), policy, ['GET', 'HEAD', 'OPTIONS'])!;
        expect(response.status).toBe(204);
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD, OPTIONS');
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://allowed.example');
        expect(response.headers.get('Access-Control-Max-Age')).toBe('600');
        expect(handleCors(request({'Access-Control-Request-Method': 'DELETE'}), policy, ['GET', 'HEAD'])?.status).toBe(405);
        expect(handleCors(request(), {...policy, allowedMethods: ['POST']}, ['GET'])?.status).toBe(405);
        expect(handleCors(request(), policy, [])?.status).toBe(405);
        const noRun = () => {throw new Error('Do not execute handlers');};
        expect(getAllowedMethods({GET: noRun})).toEqual(['GET', 'HEAD', 'OPTIONS']);
        expect(getAllowedMethods({GET: noRun, default: noRun})).toContain('DELETE');
        expect(getAllowedMethods({websocket: {message: noRun}})).toEqual(['GET', 'OPTIONS']);
    });
    test('preserves ordinary OPTIONS and rejects invalid/denied preflights', () =>
    {
        const ordinaryHeaders: Record<string, string>[] = [{}, {Origin: 'https://allowed.example'}, {'Access-Control-Request-Method': 'GET'}];
        for (const headers of ordinaryHeaders)
        {
            const ordinary = new Request('http://localhost', {method: 'OPTIONS', headers});
            expect(isCorsPreflight(ordinary)).toBeFalse();
            expect(handleCors(ordinary, policy, ['GET'])).toBeNull();
        }
        expect(isCorsPreflight(request({}, 'GET'))).toBeFalse();
        expect(handleCors(request(), {...policy, enabled: false}, ['GET'])).toBeNull();
        for (const Origin of ['https://denied.example', 'null'])
            expect(handleCors(request({Origin}), policy, ['GET'])?.status).toBe(403);
        for (const method of ['GET, DELETE', '', 'GÉT'])
            expect(handleCors(request({'Access-Control-Request-Method': method}), policy, ['GET'])?.status).toBe(400);
    });
    test('validates every requested header including wildcard/Authorization semantics', () =>
    {
        const allowed = handleCors(request({'Access-Control-Request-Headers': 'CONTENT-TYPE, authorization, Content-Type'}), policy, ['GET'])!;
        expect(allowed.status).toBe(204);
        expect(allowed.headers.get('Access-Control-Allow-Headers')).toBe('content-type, authorization');
        for (const header of ['Content-Type, X-Unknown', 'X-Unknown'])
            expect(handleCors(request({'Access-Control-Request-Headers': header}), policy, ['GET'])?.status).toBe(403);
        for (const header of ['', 'Content-Type,', 'X-Header: invalid'])
            expect(handleCors(request({'Access-Control-Request-Headers': header}), policy, ['GET'])?.status).toBe(400);
        const wildcard = {...policy, allowedHeaders: ['*']};
        expect(handleCors(request({'Access-Control-Request-Headers': 'x-test'}), wildcard, ['GET'])?.status).toBe(204);
        expect(handleCors(request({'Access-Control-Request-Headers': 'authorization'}), wildcard, ['GET'])?.status).toBe(403);
        expect(handleCors(request({'Access-Control-Request-Headers': 'x-test'}), {...wildcard, allowCredentials: true}, ['GET'])?.status).toBe(403);
    });
    test.each([undefined, 'https://allowed.example', 'https://denied.example'])('varies every allowlist response: %s', (origin) =>
    {
        const response = new Response(null, {headers: {Vary: 'Accept-Encoding'}});
        const req = new Request('http://localhost', {headers: origin ? {Origin: origin} : {}});
        applyCorsHeaders(response, req, policy);
        applyCorsHeaders(response, req, policy);
        expect(response.headers.get('Vary')).toBe('Accept-Encoding, Origin');
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin === 'https://allowed.example' ? origin : null);
    });
    test('keeps wildcard/no-origin responses cache-compatible and rejects wildcard credentials', () =>
    {
        const wildcard = {...policy, allowedOrigins: ['*']};
        const response = new Response();
        applyCorsHeaders(response, new Request('http://localhost'), wildcard);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.has('Vary')).toBeFalse();
        expect(corsSchema.safeParse({...wildcard, allowCredentials: true}).success).toBeFalse();
        const vary = new Headers({Vary: '*'});
        appendVary(vary, 'Origin');
        expect(vary.get('Vary')).toBe('*');
    });
});
