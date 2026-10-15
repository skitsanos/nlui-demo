import {strict as assert} from 'node:assert';

// Separate fetch calls are separate cookie jars unless we explicitly copy one.
// Never print the opaque session cookie or store it in a report.
export const probeOwnedSessions = async (url: string): Promise<void> =>
{
    const request = (path: string, cookie?: string, init: RequestInit = {}) => fetch(`${url}${path}`, {
        ...init, headers: {...Object.fromEntries(new Headers(init.headers)), ...cookie && {Cookie: cookie}}, signal: AbortSignal.timeout(10_000)
    });
    const first = await request('/api/conversations'); const other = await request('/api/conversations');
    const cookie = first.headers.get('Set-Cookie')!.split(';')[0]!;
    const otherCookie = other.headers.get('Set-Cookie')!.split(';')[0]!;
    await first.arrayBuffer(); await other.arrayBuffer(); assert.notEqual(cookie, otherCookie);
    const conversationId = `probe-${crypto.randomUUID()}`;
    const created = await request('/api/analysis', cookie, {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({conversationId, requestId: `probe-${crypto.randomUUID()}`, plan: {metric: 'registered_customer_count'}})});
    assert.equal(created.status, 200); const {receipt} = await created.json();
    const own = await request(`/api/conversations?conversationId=${conversationId}`, cookie);
    assert.equal(own.status, 200); assert.ok((await own.json()).events.length > 0);
    for (const path of [`/api/conversations?conversationId=${conversationId}`,
        `/api/analysis?conversationId=${conversationId}&resultId=${receipt.resultId}&debug=sql`])
    {
        const denied = await request(path, otherCookie); assert.equal(denied.status, 404); await denied.arrayBuffer();
    }
    const form = new FormData(); form.append('file', new File(['month,region,revenue_eur,order_count\n2026-06,West,1,1\n'], 'aggregate.csv', {type: 'text/csv'}));
    const inspected = await request('/api/datasets/preview', cookie, {method: 'POST', body: form});
    assert.equal(inspected.status, 200); const preview = await inspected.json(); assert.equal(preview.executable, false);
    const denied = await request(`/api/datasets/preview?id=${preview.id}`, otherCookie);
    assert.equal(denied.status, 404); await denied.arrayBuffer();
};
