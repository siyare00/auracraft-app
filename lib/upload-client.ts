import { validateUploadMetadata } from './upload-policy.ts';

type UploadOptions = {
  signal: AbortSignal;
  fetcher?: typeof fetch;
  onProgress?: (message: string) => void;
};

export async function uploadImage(file: File, options: UploadOptions) {
  const result = validateUploadMetadata({ filename: file.name, type: file.type, size: file.size });
  if (!result.ok) throw new Error(result.error);
  const fetcher = options.fetcher ?? fetch;
  options.onProgress?.('Requesting secure upload access…');
  const response = await fetcher('/api/r2-sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result.value),
    cache: 'no-store',
    signal: options.signal,
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Sign in before uploading.');
    if (response.status === 429) throw new Error('Upload limit reached. Try again later.');
    if (response.status === 503) throw new Error('Uploads are not available yet. Secure account access and storage checks are still being completed.');
    throw new Error('Could not request an upload. Please try again later.');
  }
  let signature: unknown;
  try { signature = await response.json(); }
  catch { throw new Error('The upload service returned an invalid response.'); }
  const { url, key } = (signature ?? {}) as Record<string, unknown>;
  if (typeof url !== 'string' || typeof key !== 'string' ||
      !/^uploads\/pending\/[A-Za-z0-9_-]{1,128}\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key)) {
    throw new Error('The upload service returned an invalid response.');
  }
  let destination: URL;
  try { destination = new URL(url); }
  catch { throw new Error('The upload service returned an invalid response.'); }
  if (destination.protocol !== 'https:' || destination.username || destination.password ||
      !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(destination.hostname) || destination.port) {
    throw new Error('The upload service returned an invalid destination.');
  }
  options.onProgress?.('Uploading image…');
  const uploaded = await fetcher(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
    signal: options.signal,
  });
  if (!uploaded.ok) throw new Error('Upload failed or expired. Please try again.');
  return { key };
}
