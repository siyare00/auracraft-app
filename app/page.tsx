import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <p className="text-sm uppercase tracking-widest">Development preview</p>
      <h1 className="mt-4 text-5xl font-semibold tracking-tight">AuraCraft</h1>
      <p className="mt-6 text-xl">A workspace in progress for creative image tools.</p>
      <p className="mt-4">This repository currently contains an upload prototype. Account access, image generation, project storage, and production operations are still being built.</p>
      <section className="mt-10 rounded-xl border p-6" aria-labelledby="prototype-title">
        <h2 id="prototype-title" className="text-2xl font-semibold">Upload prototype</h2>
        <p className="mt-3">Check image metadata locally. Uploads stay unavailable until the required security and storage integrations are ready.</p>
        <Link href="/test" className="mt-6 inline-block rounded border px-4 py-2">Open upload prototype</Link>
      </section>
    </main>
  );
}
