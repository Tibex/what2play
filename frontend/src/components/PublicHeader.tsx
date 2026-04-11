'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLoginModalStore } from '@/lib/login-modal-store';
import { useRegisterModalStore } from '@/lib/register-modal-store';

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

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
];

export default function PublicHeader() {
  const pathname = usePathname();
  const openLoginModal = useLoginModalStore((s) => s.open);
  const openRegisterModal = useRegisterModalStore((s) => s.open);

  if (!shouldShowPublicHeader(pathname)) {
    return null;
  }

  const isLandingPage = pathname === '/';

  return (
    <header
      className="sticky top-0 z-30 backdrop-blur-md"
      style={{
        background: 'rgba(245, 242, 235, 0.88)',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 1px 0 0 rgba(220,215,204,0.5)',
      }}
    >
      <div className="wt-page px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-base no-underline shrink-0"
            style={{ color: 'var(--foreground)' }}
          >
            <Image
              src="/meeple-photo-full-64.png"
              alt=""
              width={24}
              height={24}
              className="shrink-0"
            />
            <span>
              What2<span style={{ color: 'var(--primary)' }}>Play</span>
            </span>
          </Link>

          {isLandingPage && (
            <nav className="hidden sm:flex items-center gap-0.5" aria-label="Site navigation">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="px-3 py-1.5 text-sm rounded-lg no-underline transition-colors duration-150 cursor-pointer"
                  style={{ color: 'var(--muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--foreground)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          )}
        </div>

        <nav className="flex items-center gap-2" aria-label="Auth navigation">
          <button
            type="button"
            onClick={openLoginModal}
            className="px-3.5 py-2 text-sm font-medium rounded-lg transition-colors duration-150 cursor-pointer"
            style={{ color: 'var(--muted)', background: 'transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--foreground)';
              e.currentTarget.style.background = 'var(--surface)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--muted)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={openRegisterModal}
            className="wt-btn wt-btn-primary px-3.5 py-2 text-sm"
          >
            Get started
          </button>
        </nav>
      </div>
    </header>
  );
}
