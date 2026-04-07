'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/store';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
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

  return (
    <nav className="overflow-x-clip border-b border-[var(--border-strong)] bg-[linear-gradient(90deg,#1f2f4d,#2a4677,#365fb3)] text-slate-50 shadow-[0_10px_20px_rgba(18,30,54,.22)]">
      <div className="wt-page px-4">
        <div className="flex items-center justify-between py-3">
          <Link
            href="/dashboard"
            className="min-w-0 pr-2 text-base sm:text-xl font-bold tracking-tight leading-tight truncate"
          >
            What2Play
          </Link>

          <div className="hidden sm:flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm font-medium transition-colors hover:text-sky-200"
            >
              Events
            </Link>
            <Link
              href="/collection"
              className="text-sm font-medium transition-colors hover:text-sky-200"
            >
              Collection
            </Link>
            <Link
              href="/friends"
              className="text-sm font-medium transition-colors hover:text-sky-200"
            >
              Friends
            </Link>
            <Link
              href="/groups"
              className="text-sm font-medium transition-colors hover:text-sky-200"
            >
              Groups
            </Link>
            {user?.role === 'admin' && (
              <Link
                href="/admin"
                className="text-sm font-medium transition-colors hover:text-sky-200"
              >
                Admin
              </Link>
            )}
            <Link
              href="/profile"
              className="text-sm font-medium transition-colors hover:text-sky-200"
            >
              Profile
            </Link>

            <div className="ml-4 flex items-center gap-3 border-l border-blue-200/30 pl-4">
              <span className="text-sm text-blue-100">{user?.name}</span>
              <button
                onClick={handleLogout}
                className="wt-btn rounded-md border border-blue-100/35 bg-blue-50/15 px-3 py-1.5 text-sm hover:bg-blue-50/25"
              >
                Logout
              </button>
            </div>
          </div>

          <button
            ref={toggleButtonRef}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="sm:hidden inline-flex items-center justify-center rounded-md p-2 transition-colors hover:bg-blue-50/20"
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-menu"
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

        {menuOpen && (
          <div
            id="mobile-nav-menu"
            ref={menuRef}
            className="sm:hidden pb-4"
          >
            <div className="flex flex-col gap-2 mt-2">
              <Link
                href="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="py-1 text-sm font-medium transition-colors hover:text-sky-200"
              >
                Events
              </Link>
              <Link
                href="/collection"
                onClick={() => setMenuOpen(false)}
                className="py-1 text-sm font-medium transition-colors hover:text-sky-200"
              >
                Collection
              </Link>
              <Link
                href="/friends"
                onClick={() => setMenuOpen(false)}
                className="py-1 text-sm font-medium transition-colors hover:text-sky-200"
              >
                Friends
              </Link>
              <Link
                href="/groups"
                onClick={() => setMenuOpen(false)}
                className="py-1 text-sm font-medium transition-colors hover:text-sky-200"
              >
                Groups
              </Link>
              {user?.role === 'admin' && (
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="py-1 text-sm font-medium transition-colors hover:text-sky-200"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="py-1 text-sm font-medium transition-colors hover:text-sky-200"
              >
                Profile
              </Link>

              <div className="mt-2 border-t border-blue-100/30 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-100">{user?.name}</span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="wt-btn rounded-md border border-blue-100/35 bg-blue-50/15 px-3 py-1.5 text-sm hover:bg-blue-50/25"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
