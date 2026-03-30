import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import ToastProvider from '@/components/ToastProvider';
import PwaRegistration from '@/components/PwaRegistration';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Board Game Night',
  description: 'Plan game nights, vote on games, and track your collection',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Board Game Night',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/next.svg',
    apple: '/next.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        <ToastProvider />
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
