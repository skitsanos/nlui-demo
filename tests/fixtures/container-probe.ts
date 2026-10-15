import {strict as assert} from 'node:assert';
import {readdir} from 'node:fs/promises';

// Copied into an owned, network-disabled production container by the host gate.
// No test-only route or fixture server is added to the image/application.
const url = 'http://127.0.0.1:3180';
const request = (path: string, init?: RequestInit) => fetch(`${url}${path}`, {...init, signal: AbortSignal.timeout(3_000)});
for (let attempt = 0; ; attempt++)
{
    try {assert.equal((await request('/api/health')).status, 200); break;}
    catch {if (attempt >= 100) throw new Error('Container startup timed out'); await Bun.sleep(100);}
}
assert.notEqual(process.getuid?.(), 0, 'Runtime user must not be root');
assert.equal(process.cwd(), '/app');
assert.equal(process.env.OPENAI_API_KEY, undefined);
assert.equal(process.env.CHAT_MODEL, undefined);
for (const path of ['.env', '.git/config', 'data/demo.sqlite', 'data/conversations.sqlite', 'tests/http-smoke.hurl', 'docs/issues/README.md'])
{
    assert.equal(await Bun.file(`/app/${path}`).exists(), false, `Private/generated/test file packaged: ${path}`);
}
assert.deepEqual(await readdir('/app/uploads'), []);
for (const path of ['/', '/docs/readme', '/docs/architecture', '/api/version'])
{
    const response = await request(path);
    assert.equal(response.status, 200, path);
    await response.arrayBuffer();
}
const config = await (await request('/api/config')).json();
// The public config endpoint reports YAML defaults; successful requests to 3180
// and Docker's own healthcheck establish the effective PORT override.
assert.equal(typeof config.server.port, 'number');
assert.equal(config.chat.configured, false);
assert.deepEqual(Object.keys(config.server.ssl), ['enabled']);
const invalid = await request('/api/chat', {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({input: {type: 'user_text', text: ''}})});
assert.equal(invalid.status, 400);
await invalid.arrayBuffer();
assert.equal((await request('/does-not-exist')).status, 404);
const form = new FormData();
form.append('file', new File(['owned container upload'], 'probe.txt', {type: 'text/plain'}));
const upload = await request('/api/upload', {method: 'POST', body: form});
assert.equal(upload.status, 200);
const saved = await upload.json();
assert.match(saved.fileName, /^uploaded_[0-9a-f-]{36}_probe\.txt$/);
assert.equal(await Bun.file(`/app/uploads/${saved.fileName}`).text(), 'owned container upload');
await Bun.write('/app/data/qualification-writable', 'owned');
// Exercise lazy default-path seeding and the actual read-only SQL worker using
// only production dependencies, after proving no retained SQLite was packaged.
const {queryDataset} = await import(`${process.cwd()}/src/data/queryDataset.ts`);
const customers = await queryDataset('SELECT COUNT(*) AS customer_count FROM customers');
assert.equal(customers.returnedRowCount, 1);
assert.equal(customers.rows[0].c0, 200);
assert.equal(await Bun.file('/app/data/demo.sqlite').exists(), true);
const {probeOwnedSessions} = await import(`${process.cwd()}/scripts/http-session-probe.ts`);
await probeOwnedSessions(url);
// The real Dockerfile healthcheck runs independently of this HTTP probe.
await Bun.sleep(1_200);
console.log(`Container HTTP probe passed as UID ${process.getuid?.()}; port 3180; provider unconfigured.`);
