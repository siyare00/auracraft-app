import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AuraCraft | Development preview',
  description: 'AuraCraft creative tools development preview. Upload and generation services are not yet available.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="antialiased">{children}</body></html>;
}
