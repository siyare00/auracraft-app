import { randomUUID } from 'node:crypto';
import { validateUploadMetadata, type UploadMetadata } from '../upload-policy.ts';

const MAX_REQUEST_BYTES = 2048;
export const UPLOAD_URL_TTL_SECONDS = 60;
export type UploadIdentity = { id: string };
export type UploadIntent = { key: string; type: UploadMetadata['type']; size: number };
export type UploadServices = {
  origin: string;
  storageOrigin: string;
  /** Verify a real server-side session. Never trust a client-supplied user ID. */
  authenticate: (request: Request) => Promise<UploadIdentity | null>;
  /** Atomically persist the intent and reserve the user's rate/byte quota. */
  reserve: (identity: UploadIdentity, intent: UploadIntent) => Promise<boolean>;
  sign: (intent: UploadIntent, expiresIn: number) => Promise<string>;
};

function json(body: object, status: number, extraHeaders: Record<string, string> = {}) {
  return Response.json(body, { status, headers: {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  } });
}

export function methodNotAllowed() {
  return json({ error: 'Use POST to request an upload.' }, 405, { Allow: 'POST' });
}

export function createUploadKey(identity: UploadIdentity, metadata: UploadMetadata) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(identity.id)) {
    throw new Error('Invalid internal user ID');
  }
  const extension = metadata.type === 'image/jpeg' ? 'jpg' : metadata.type.split('/')[1];
  // Original filenames and arbitrary caller-provided paths are never storage keys.
  return `uploads/pending/${identity.id}/${randomUUID()}.${extension}`;
}

async function readMetadata(request: Request): Promise<unknown> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_REQUEST_BYTES)) {
    throw new Error('Invalid body size');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new Error('Body too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

function validServices(services: UploadServices) {
  try {
    return [services.origin, services.storageOrigin].every(origin => {
      const url = new URL(origin);
      return url.protocol === 'https:' && url.origin === origin && !url.username && !url.password;
    });
  } catch { return false; }
}

/** A null integration always fails closed, including when R2 env vars exist. */
export function createUploadHandler(services: UploadServices | null) {
  return async function POST(request: Request) {
    if (request.method !== 'POST') return methodNotAllowed();
    if (!services || !validServices(services)) {
      return json({ error: 'Uploads are unavailable until secure account access and storage checks are configured.' }, 503);
    }
    if (request.headers.get('origin') !== services.origin) {
      return json({ error: 'This upload request is not allowed.' }, 403);
    }
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return json({ error: 'Send file metadata as JSON.' }, 415);
    }
    try {
      const identity = await services.authenticate(request);
      if (!identity) return json({ error: 'Sign in before uploading.' }, 401);
      let body: unknown;
      try { body = await readMetadata(request); }
      catch { return json({ error: 'Invalid or oversized file metadata.' }, 400); }
      const result = validateUploadMetadata(body);
      if (!result.ok) return json({ error: result.error }, 400);
      const intent = { key: createUploadKey(identity, result.value), type: result.value.type, size: result.value.size };
      if (!await services.reserve(identity, intent)) {
        return json({ error: 'Upload limit reached. Try again later.' }, 429);
      }
      const url = await services.sign(intent, UPLOAD_URL_TTL_SECONDS);
      if (new URL(url).origin !== services.storageOrigin) throw new Error('Unexpected storage URL');
      return json({ url, key: intent.key, expiresIn: UPLOAD_URL_TTL_SECONDS }, 200);
    } catch {
      // Never leak SDK errors, credentials, or signed URLs to clients or logs.
      return json({ error: 'Uploads are temporarily unavailable. Please try again later.' }, 503);
    }
  };
}
