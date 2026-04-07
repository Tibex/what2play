'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLoginModalStore } from '@/lib/login-modal-store';
import { useRegisterModalStore } from '@/lib/register-modal-store';

/** Opens auth modals when URL has `?m=login|register` and strips the query. */
export default function LoginModalQuerySync() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const openLogin = useLoginModalStore((s) => s.open);
  const openRegister = useRegisterModalStore((s) => s.open);

  useEffect(() => {
    const modal = searchParams.get('m');
    if (modal !== 'login' && modal !== 'register') return;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('m');
    const query = nextParams.toString();
    const cleanedUrl = query ? `${pathname}?${query}` : pathname;

    if (globalThis.window === undefined || localStorage.getItem('accessToken')) {
      router.replace(cleanedUrl, { scroll: false });
      return;
    }

    if (modal === 'register') {
      openRegister();
    } else {
      openLogin();
    }
    router.replace(cleanedUrl, { scroll: false });
  }, [searchParams, pathname, router, openLogin, openRegister]);

  return null;
}
