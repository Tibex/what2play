'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/store';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleLogout = () => {
    logout();
    router.push('/?m=login');
    setMenuOpen(false);
  };

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const onDocumentClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (toggleButtonRef.current?.contains(target)) return;
      setMenuOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onDocumentClick);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onDocumentClick);
    };
  }, [menuOpen]);

  if (!isAuthenticated) return null;

  const navLinks = [
    { href: '/dashboard', label: 'Events' },
    { href: '/collection', label: 'Collection' },
    { href: '/friends', label: 'Friends' },
    ...(user?.role === 'admin' ? [{ href: '/admin', label: 'Admin' }] : []),
    { href: '/profile', label: 'Profile' },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <nav className="border-b border-[var(--border)] bg-[var(--paper)] shadow-[0_2px_8px_rgba(26,28,25,0.07)]">
      <div className="wt-page px-4">
        <div className="flex items-center justify-between py-3">
          <Link
            href="/dashboard"
            className="min-w-0 pr-2 text-base sm:text-lg font-bold tracking-tight leading-tight truncate no-underline"
            style={{ color: 'var(--foreground)' }}
          >
            What2<span style={{ color: 'var(--primary)' }}>Play</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 text-sm font-medium rounded-lg no-underline transition-colors duration-150"
                style={{
                  color: isActive(link.href) ? 'var(--primary)' : 'var(--muted)',
                  background: isActive(link.href) ? 'var(--primary-soft)' : 'transparent',
                }}
              >
                {link.label}
              </Link>
            ))}

            <div className="ml-3 flex items-center gap-2.5 border-l border-[var(--border)] pl-3">
              <span className="text-sm" style={{ color: 'var(--muted)' }}>
                {user?.name}
              </span>
              <button
                onClick={handleLogout}
                className="wt-btn wt-btn-secondary px-3 py-1.5 text-sm"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            ref={toggleButtonRef}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="sm:hidden inline-flex items-center justify-center rounded-lg p-2 transition-colors hover:bg-[var(--surface)]"
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-menu"
            style={{ color: 'var(--muted)' }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div
            id="mobile-nav-menu"
            ref={menuRef}
            className="sm:hidden pb-4"
          >
            <div className="flex flex-col gap-1 mt-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2 text-sm font-medium rounded-lg no-underline transition-colors duration-150"
                  style={{
                    color: isActive(link.href) ? 'var(--primary)' : 'var(--foreground)',
                    background: isActive(link.href) ? 'var(--primary-soft)' : 'transparent',
                  }}
                >
                  {link.label}
                </Link>
              ))}

              <div className="mt-3 border-t border-[var(--border)] pt-3 flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--muted)' }}>
                  {user?.name}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="wt-btn wt-btn-secondary px-3 py-1.5 text-sm"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
