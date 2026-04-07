'use client';

import type { ReactNode } from 'react';
import { useAuthStore } from '@/lib/store';

export default function AdminAccessGate({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { user } = useAuthStore();

  if (user?.role !== 'admin') {
    return (
      <div className="rounded-xl border border-[#ddb5ae] bg-[var(--danger-soft)] p-4 text-[var(--danger)]">
        Admin access required.
      </div>
    );
  }

  return <>{children}</>;
}
