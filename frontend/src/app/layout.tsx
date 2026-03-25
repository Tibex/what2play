import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import ToastProvider from '@/components/ToastProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Board Game Night',
  description: 'Plan game nights, vote on games, and track your collection',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        <ToastProvider />
        {children}
      </body>
    </html>
  );
}
