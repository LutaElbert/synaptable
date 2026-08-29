import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SynapTable — Image to editable layers',
  description:
    'Turn concept maps and diagram images into editable vector layers in a precise, local-first canvas.',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'SynapTable — Image to editable layers',
    description: 'Turn images into editable vector paths and organized layers, directly in your browser.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SynapTable — Image to editable layers',
    description: 'Turn images into editable vector paths and organized layers, directly in your browser.',
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
