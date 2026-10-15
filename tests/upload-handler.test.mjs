import test from 'node:test';
import assert from 'node:assert/strict';
import { createUploadHandler } from '../lib/server/upload-handler.ts';
import { GET, POST } from '../app/api/r2-sign/route.ts';

const origin = 'https://app.example';
const storageOrigin = `https://${'a'.repeat(32)}.r2.cloudflarestorage.com`;
const metadata = { filename: 'photo.png', type: 'image/png', size: 400 };
function request(body = JSON.stringify(metadata), headers = {}, method = 'POST') {
  return new Request(`${origin}/api/r2-sign`, { method, headers: { origin, 'content-type': 'application/json', ...headers }, ...(method === 'POST' ? { body } : {}) });
}
function setup(overrides = {}) {
  const calls = [];
  const services = {
    origin, storageOrigin,
    authenticate: async () => ({ id: 'user1' }),
    reserve: async (identity, intent) => { calls.push(['reserve', identity, intent]); return true; },
    sign: async (intent, ttl) => { calls.push(['sign', intent, ttl]); return `${storageOrigin}/bucket/${intent.key}?test-signature`; },
    ...overrides,
  };
  return { handler: createUploadHandler(services), calls };
}
test('production route cannot sign with bearer tokens or user headers', async () => {
  const res = await POST(request(undefined, { authorization: 'Bearer fake', 'x-user-id': 'admin' }));
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal((await res.json()).url, undefined);
});
test('legacy GET never signs and is non-cacheable', async () => {
  const res = await GET();
  assert.equal(res.status, 405); assert.equal(res.headers.get('allow'), 'POST');
  assert.equal(res.headers.get('cache-control'), 'no-store');
});
test('missing or insecure integration fails closed', async () => {
  assert.equal((await createUploadHandler(null)(request())).status, 503);
  assert.equal((await setup({ origin: 'http://app.example' }).handler(request())).status, 503);
});
for (const badOrigin of ['', 'https://evil.example', `${origin}.evil.example`]) {
  test(`rejects origin ${badOrigin || '(empty)'}`, async () => {
    const { handler, calls } = setup();
    assert.equal((await handler(request(undefined, { origin: badOrigin }))).status, 403);
    assert.equal(calls.length, 0);
  });
}
test('unauthenticated requests never reserve or sign', async () => {
  const { handler, calls } = setup({ authenticate: async () => null });
  assert.equal((await handler(request())).status, 401); assert.equal(calls.length, 0);
});
test('rejects unexpected media type', async () => {
  assert.equal((await setup().handler(request(undefined, { 'content-type': 'text/plain' }))).status, 415);
});
for (const body of ['invalid-json', JSON.stringify({ ...metadata, type: 'image/svg+xml' }), 'x'.repeat(2049), JSON.stringify({ ...metadata, size: 999999999 })]) {
  test(`rejects invalid metadata/body (${body.length} bytes)`, async () => {
    const { handler, calls } = setup();
    assert.equal((await handler(request(body))).status, 400); assert.equal(calls.length, 0);
  });
}
test('rejects oversized or invalid declared request size before signing', async () => {
  for (const length of ['999999', '-1', 'garbage']) {
    const { handler, calls } = setup();
    assert.equal((await handler(request(undefined, { 'content-length': length }))).status, 400);
    assert.equal(calls.length, 0);
  }
});
test('quota denial never signs', async () => {
  const { handler, calls } = setup({ reserve: async () => false });
  assert.equal((await handler(request())).status, 429); assert.equal(calls.length, 0);
});
test('invalid internal identity cannot select a different user scope', async () => {
  const { handler, calls } = setup({ authenticate: async () => ({ id: '../victim' }) });
  assert.equal((await handler(request())).status, 503); assert.equal(calls.length, 0);
});
test('reserves a server-generated scoped key before short-lived signing', async () => {
  const { handler, calls } = setup();
  const res = await handler(request());
  assert.equal(res.status, 200); assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  assert.deepEqual(calls.map(call => call[0]), ['reserve', 'sign']);
  assert.equal(calls[1][2], 60); assert.equal(calls[1][1].size, metadata.size);
  assert.match(body.key, /^uploads\/pending\/user1\//);
  assert.equal(body.publicUrl, undefined); assert.equal(body.expiresIn, 60);
});
test('unexpected storage destination fails closed', async () => {
  assert.equal((await setup({ sign: async () => 'https://evil.example/upload' }).handler(request())).status, 503);
});
for (const dependency of ['authenticate', 'reserve', 'sign']) {
  test(`${dependency} failures do not disclose secrets or stack traces`, async () => {
    const { handler } = setup({ [dependency]: async () => { throw new Error('secret-stack-token'); } });
    const res = await handler(request()); assert.equal(res.status, 503);
    assert.ok(!(await res.text()).includes('secret-stack-token'));
  });
}
