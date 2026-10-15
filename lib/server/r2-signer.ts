import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MAX_UPLOAD_BYTES, SUPPORTED_UPLOAD_TYPES } from '../upload-policy.ts';
import { UPLOAD_URL_TTL_SECONDS, type UploadIntent } from './upload-handler.ts';

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

/** Server-only integration helper. The public route does not instantiate it. */
export function createR2Signer(config: R2Config) {
  if (!/^[a-f0-9]{32}$/i.test(config.accountId) ||
      !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(config.bucket) ||
      !config.accessKeyId.trim() || !config.secretAccessKey.trim()) {
    throw new Error('R2 configuration is incomplete or invalid');
  }
  const client = new S3Client({
    region: 'auto',
    forcePathStyle: true,
    // The file body is supplied later by the browser. Do not sign an empty-body checksum.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  return async (intent: UploadIntent, expiresIn: number) => {
    if (!/^uploads\/pending\/[A-Za-z0-9_-]{1,128}\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(intent.key) ||
        !Object.hasOwn(SUPPORTED_UPLOAD_TYPES, intent.type) ||
        !intent.key.endsWith(`.${intent.type === 'image/jpeg' ? 'jpg' : intent.type.split('/')[1]}`) ||
        !Number.isSafeInteger(intent.size) || intent.size < 1 || intent.size > MAX_UPLOAD_BYTES ||
        expiresIn !== UPLOAD_URL_TTL_SECONDS) {
      throw new Error('Invalid upload intent');
    }
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: intent.key,
      ContentType: intent.type,
      ContentLength: intent.size,
    });
    return getSignedUrl(client, command, {
      expiresIn,
      signableHeaders: new Set(['content-type', 'content-length']),
    });
  };
}
