'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { uploadImage } from '../../lib/upload-client.ts';
import { validateUploadMetadata } from '../../lib/upload-policy.ts';

export default function TestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);

  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);

  const handleUpload = async () => {
    // The ref also closes the repeated-click gap before React re-renders.
    if (active.current) return;
    if (!file) { setMessage('Please select an image first.'); return; }
    const validation = validateUploadMetadata({ filename: file.name, type: file.type, size: file.size });
    if (!validation.ok) { setMessage(validation.error); return; }
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      await uploadImage(file, { signal: controller.signal, onProgress: (status) => { if (active.current === controller) setMessage(status); } });
      if (active.current === controller) setMessage('Upload received. It must pass server-side validation before it can be used.');
    } catch (error) {
      if (active.current === controller) {
        setMessage(controller.signal.aborted
          ? 'Upload cancelled or timed out. You can try again.'
          : error instanceof Error && error.message !== 'Failed to fetch'
            ? error.message
            : 'Network error. Check your connection and try again.');
      }
    } finally {
      clearTimeout(timeout);
      if (active.current === controller) { active.current = null; setBusy(false); }
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link className="underline" href="/">Back to AuraCraft</Link>
      <h1 className="mt-8 text-3xl font-semibold">Upload prototype</h1>
      <p className="mt-4">Uploads are currently unavailable while secure account access and storage validation are being completed. You can select an image to check its declared type and size locally.</p>
      <p id="file-help" className="mt-4 text-sm">JPEG, PNG, or WebP. Maximum 5 MiB. File contents are not verified by these metadata checks.</p>
      <label className="mt-8 block font-medium" htmlFor="upload-image">Choose an image</label>
      <input
        className="mt-2 block w-full rounded border p-3"
        id="upload-image"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-describedby="file-help"
        disabled={busy}
        onChange={(event) => {
          const selected = event.target.files?.[0] ?? null;
          setFile(selected);
          if (!selected) { setMessage(''); return; }
          const check = validateUploadMetadata({ filename: selected.name, type: selected.type, size: selected.size });
          setMessage(check.ok ? 'File metadata looks supported. Upload access is still unavailable.' : check.error);
        }}
      />
      <div className="mt-6 flex gap-3">
        <button className="rounded border px-4 py-2 disabled:opacity-50" onClick={handleUpload} disabled={!file || busy}>
          {busy ? 'Checking upload access…' : 'Check upload access'}
        </button>
        {busy && <button className="rounded border px-4 py-2" onClick={() => active.current?.abort()}>Cancel</button>}
      </div>
      <p className="mt-6" role="status" aria-live="polite">{message}</p>
    </main>
  );
}
