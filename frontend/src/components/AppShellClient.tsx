'use client';

import Navbar from '@/components/Navbar';
import AuthGuard from '@/components/AuthGuard';

export default function AppShellClient({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthGuard>
      <div className="min-h-screen overflow-x-hidden">
        <Navbar />
        <main className="wt-page px-4 py-8">{children}</main>
      </div>
    </AuthGuard>
  );
}
