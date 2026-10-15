import test from 'node:test';
import assert from 'node:assert/strict';
import { createR2Signer } from '../lib/server/r2-signer.ts';

// Deliberately fake test inputs. Signing happens locally; no storage call is made.
const config = { accountId: 'a'.repeat(32), bucket: 'private-test-bucket', accessKeyId: 'fake-test-access', secretAccessKey: 'fake-test-secret' };
const intent = { key: 'uploads/pending/user1/11111111-1111-4111-a111-111111111111.png', type: 'image/png', size: 400 };
test('rejects missing or malformed R2 configuration', () => {
  for (const change of [{ accountId: '' }, { accountId: 'https://evil.example' }, { bucket: '../bucket' }, { accessKeyId: '' }, { secretAccessKey: ' ' }]) {
    assert.throws(() => createR2Signer({ ...config, ...change }), /configuration/);
  }
});
test('signs only a short-lived scoped PUT with type and length constraints', async () => {
  const sign = createR2Signer(config);
  const url = new URL(await sign(intent, 60));
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, `${config.accountId}.r2.cloudflarestorage.com`);
  assert.equal(url.pathname, `/${config.bucket}/${intent.key}`);
  assert.equal(url.searchParams.get('X-Amz-Expires'), '60');
  const headers = url.searchParams.get('X-Amz-SignedHeaders').split(';');
  assert.ok(headers.includes('content-type')); assert.ok(headers.includes('content-length'));
  assert.equal(url.searchParams.has('x-amz-checksum-crc32'), false);
});
test('rejects unsafe intent before signing', async () => {
  const sign = createR2Signer(config);
  for (const change of [{ key: '../escape.png' }, { key: 'uploads/public/file.png' }, { type: 'image/svg+xml' }, { type: 'image/jpeg' }, { size: 0 }, { size: 6 * 1024 * 1024 }]) {
    await assert.rejects(sign({ ...intent, ...change }, 60), /Invalid upload intent/);
  }
  await assert.rejects(sign(intent, 3600), /Invalid upload intent/);
});
