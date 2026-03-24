'use client';

import Navbar from '@/components/Navbar';
import AuthGuard from '@/components/AuthGuard';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </AuthGuard>
  );
}
