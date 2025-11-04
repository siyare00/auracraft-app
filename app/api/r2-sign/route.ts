import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filename = (searchParams.get('filename') || '').trim();
  const type = searchParams.get('type') || 'application/octet-stream';

  // Defensive checks – the error you’re seeing comes from here
  if (!filename || filename === 'undefined' || filename === 'null') {
    return NextResponse.json({ error: 'Missing file name' }, { status: 400 });
  }

  const key = `${Date.now()}-${filename}`;

  const cmd = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET!,
    Key: key,
    ContentType: type,
  });

  const url = await getSignedUrl(r2, cmd, { expiresIn: 300 });
  const publicUrl = `${process.env.R2_PUBLIC_URL}/${encodeURIComponent(key)}`;

  return NextResponse.json({ url, key, publicUrl });
}
