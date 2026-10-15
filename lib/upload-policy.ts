/** Metadata checks only. These do not inspect or verify the uploaded bytes. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const SUPPORTED_UPLOAD_TYPES = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
} as const;

export type UploadType = keyof typeof SUPPORTED_UPLOAD_TYPES;
export type UploadMetadata = { filename: string; type: UploadType; size: number };
export type UploadValidation =
  | { ok: true; value: UploadMetadata }
  | { ok: false; error: string };

export function validateUploadMetadata(value: unknown): UploadValidation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'Choose a JPEG, PNG, or WebP image.' };
  }
  const { filename, type, size } = value as Record<string, unknown>;
  if (typeof filename !== 'string' || !filename.trim() || filename.length > 200 ||
      /[/\\\u0000-\u001f\u007f]/.test(filename)) {
    return { ok: false, error: 'Choose a file with a valid name (up to 200 characters).' };
  }
  if (typeof type !== 'string' || !Object.hasOwn(SUPPORTED_UPLOAD_TYPES, type)) {
    return { ok: false, error: 'Only JPEG, PNG, and WebP images are supported.' };
  }
  const extension = filename.split('.').pop()?.toLowerCase();
  const extensions: readonly string[] = SUPPORTED_UPLOAD_TYPES[type as UploadType];
  if (!extension || !extensions.includes(extension)) {
    return { ok: false, error: 'The file extension must match its image type.' };
  }
  if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 1 || size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'Choose a non-empty image no larger than 5 MiB.' };
  }
  return { ok: true, value: { filename, type: type as UploadType, size } };
}
