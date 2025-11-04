'use client';
import React, { useState } from 'react';

export default function TestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');

  const handleUpload = async () => {
    if (!file) {
      setMessage('Please select a file first.');
      return;
    }

    console.log('Uploading file:', file.name, file.type); // 🧩 Debug line

    setMessage('Requesting signed URL...');

    const sigRes = await fetch(
      `/api/r2-sign?filename=${encodeURIComponent(file.name)}&type=${encodeURIComponent(
        file.type || 'application/octet-stream'
      )}`
    );

    if (!sigRes.ok) {
      const err = await sigRes.text().catch(() => '');
      setMessage(`❌ Failed to get signed URL: ${sigRes.status} ${err}`);
      return;
    }

    const { url, publicUrl } = await sigRes.json();

    setMessage('Uploading to R2...');
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });

    if (putRes.ok) {
      setMessage(`✅ Upload successful! File URL: ${publicUrl}`);
    } else {
      const t = await putRes.text().catch(() => '');
      setMessage(`❌ Upload failed: ${putRes.status} ${t.slice(0, 200)}`);
    }
  };

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Cloudflare R2 Upload Test</h1>
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button onClick={handleUpload} style={{ marginLeft: '1rem' }}>
        Upload to R2
      </button>
      <p>{message}</p>
    </div>
  );
}
