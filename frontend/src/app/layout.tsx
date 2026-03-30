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
    icon: '/meeple.svg',
    apple: '/meeple.svg',
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
