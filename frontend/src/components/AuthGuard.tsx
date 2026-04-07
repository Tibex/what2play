'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLoginModalStore } from '@/lib/login-modal-store';
import { useAuthStore } from '@/lib/store';

export default function AuthGuard({ children }: Readonly<{ children: React.ReactNode }>) {
  const { isAuthenticated, loadFromStorage } = useAuthStore();
  const openLoginModal = useLoginModalStore((s) => s.open);
  const router = useRouter();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      openLoginModal();
      router.replace('/');
    }
  }, [isAuthenticated, openLoginModal, router]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return <>{children}</>;
}
