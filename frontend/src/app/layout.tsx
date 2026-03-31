import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import ToastProvider from '@/components/ToastProvider';
import PwaRegistration from '@/components/PwaRegistration';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'What2Play',
  description: 'Plan game nights, vote on games, and track your collection',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'What2Play',
    statusBarStyle: 'default',
  },
  icons: {
    shortcut: '/favicon.ico',
    icon: [
      { url: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
      { url: '/meeple-photo-full-64.png', sizes: '64x64', type: 'image/png' },
      { url: '/meeple-photo-full-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/meeple-photo-full.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/meeple-photo-full-192.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <ToastProvider />
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
