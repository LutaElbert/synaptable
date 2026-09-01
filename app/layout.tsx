import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SynapTable — Visual ideas, structured tables',
  description:
    'Capture connected ideas on a local-first canvas, organize them into editable tables, and export the result without uploading project content.',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'SynapTable — Visual ideas, structured tables',
    description: 'Move between connected canvas ideas and structured tables in a private, local-first workspace.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SynapTable — Visual ideas, structured tables',
    description: 'Move between connected canvas ideas and structured tables in a private, local-first workspace.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
