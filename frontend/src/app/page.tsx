'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LandingMarketing } from '@/components/landing/LandingMarketing';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      router.replace('/dashboard');
    }
  }, [router]);

  return <LandingMarketing />;
}
