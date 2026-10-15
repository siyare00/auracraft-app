import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadImage } from '../lib/upload-client.ts';
const file = new File(['data'], 'photo.png', { type: 'image/png' });
const key = 'uploads/pending/user1/11111111-1111-4111-a111-111111111111.png';
const url = `https://${'a'.repeat(32)}.r2.cloudflarestorage.com/bucket/${key}?test`;
const options = fetcher => ({ fetcher, signal: new AbortController().signal });
test('validates metadata before any network call', async () => {
  await assert.rejects(uploadImage(new File(['x'], 'x.svg', { type: 'image/svg+xml' }), options(() => { throw new Error('should not fetch'); })), /Only JPEG/);
});
for (const status of [401, 429, 503, 500]) {
  test(`signing failure ${status} never uploads`, async () => {
    let calls = 0;
    await assert.rejects(uploadImage(file, options(async () => { calls++; return new Response('private SDK error', { status }); })), error => !error.message.includes('private SDK error'));
    assert.equal(calls, 1);
  });
}
for (const payload of ['not JSON', JSON.stringify({}), JSON.stringify(null), JSON.stringify({ url: 'https://evil.example/upload', key })]) {
  test(`rejects malformed or unsafe signer response (${payload.length})`, async () => {
    let calls = 0;
    await assert.rejects(uploadImage(file, options(async () => { calls++; return new Response(payload); })), /invalid/);
    assert.equal(calls, 1);
  });
}
test('POSTs metadata then PUTs with the same type and abort signal', async () => {
  const requests = [];
  const signal = new AbortController().signal;
  const result = await uploadImage(file, { signal, fetcher: async (destination, init) => {
    requests.push([destination, init]);
    return requests.length === 1 ? Response.json({ url, key }) : new Response(null, { status: 200 });
  } });
  assert.equal(requests[0][0], '/api/r2-sign'); assert.equal(requests[0][1].method, 'POST');
  assert.deepEqual(JSON.parse(requests[0][1].body), { filename: file.name, type: file.type, size: file.size });
  assert.equal(requests[1][1].method, 'PUT'); assert.equal(requests[1][1].headers['Content-Type'], file.type);
  assert.equal(requests[1][1].signal, signal); assert.deepEqual(result, { key });
});
test('PUT failure does not report success', async () => {
  let calls = 0;
  await assert.rejects(uploadImage(file, options(async () => ++calls === 1 ? Response.json({ url, key }) : new Response('private error', { status: 403 }))), /Upload failed or expired/);
});
test('network failures and cancellation reject', async () => {
  await assert.rejects(uploadImage(file, options(async () => { throw new TypeError('Failed to fetch'); })), /Failed to fetch/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(uploadImage(file, { signal: controller.signal, fetcher: async (_, init) => { init.signal.throwIfAborted(); } }), { name: 'AbortError' });
});
