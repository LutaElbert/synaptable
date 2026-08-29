import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  preload: false,
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  preload: false,
});

export const metadata: Metadata = {
  title: 'SynapTable — Image to editable layers',
  description:
    'Turn concept maps and diagram images into editable vector layers in a precise, local-first canvas.',
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
