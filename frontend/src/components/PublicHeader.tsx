'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const APP_ROUTE_PREFIXES = [
  '/dashboard',
  '/events',
  '/collection',
  '/friends',
  '/profile',
  '/admin',
];

function shouldShowPublicHeader(pathname: string): boolean {
  return !APP_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default function PublicHeader() {
  const pathname = usePathname();

  if (!shouldShowPublicHeader(pathname)) {
    return null;
  }

  return (
    <header className="border-b border-[var(--border)] bg-[var(--paper)]/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="wt-page px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-lg text-[var(--primary)]"
        >
          <Image
            src="/meeple-photo-full-64.png"
            alt=""
            width={28}
            height={28}
            className="shrink-0"
          />
          What2Play
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="wt-btn wt-btn-secondary px-3 py-2 text-sm font-semibold no-underline text-[var(--foreground)]"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="wt-btn wt-btn-primary px-3 py-2 text-sm font-semibold no-underline text-white"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
