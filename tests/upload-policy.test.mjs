import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_UPLOAD_BYTES, validateUploadMetadata } from '../lib/upload-policy.ts';
import { createUploadKey } from '../lib/server/upload-handler.ts';

const valid = { filename: 'photo.jpg', type: 'image/jpeg', size: 100 };
test('accepts JPEG, PNG, and WebP, including uppercase extensions and maximum size', () => {
  for (const [filename, type] of [['photo.JPG', 'image/jpeg'], ['photo.jpeg', 'image/jpeg'], ['photo.png', 'image/png'], ['photo.webp', 'image/webp']]) {
    assert.equal(validateUploadMetadata({ filename, type, size: MAX_UPLOAD_BYTES }).ok, true);
  }
});
for (const [label, value] of Object.entries({
  null: null, array: [], 'missing fields': {},
  svg: { ...valid, filename: 'x.svg', type: 'image/svg+xml' },
  html: { ...valid, filename: 'x.html', type: 'text/html' },
  'fake extension': { ...valid, filename: 'x.svg' },
  traversal: { ...valid, filename: '../x.jpg' },
  backslash: { ...valid, filename: 'folder\\x.jpg' },
  'control character': { ...valid, filename: 'x\n.jpg' },
  'long name': { ...valid, filename: 'a'.repeat(201) + '.jpg' },
  'missing filename': { ...valid, filename: '' },
  'zero bytes': { ...valid, size: 0 },
  'negative bytes': { ...valid, size: -1 },
  oversized: { ...valid, size: MAX_UPLOAD_BYTES + 1 },
  fractional: { ...valid, size: 1.1 },
  'numeric string': { ...valid, size: '100' },
  infinite: { ...valid, size: Infinity },
  'prototype property': { ...valid, type: '__proto__' },
})) test(`rejects ${label}`, () => assert.equal(validateUploadMetadata(value).ok, false));
test('keys are unique, private-pending scoped, and never contain original filenames', () => {
  const first = createUploadKey({ id: 'user_123' }, valid);
  assert.match(first, /^uploads\/pending\/user_123\/[a-f0-9-]{36}\.jpg$/);
  assert.notEqual(first, createUploadKey({ id: 'user_123' }, valid));
  assert.ok(!first.includes('photo'));
  assert.throws(() => createUploadKey({ id: '../another-user' }, valid));
});
