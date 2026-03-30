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
    router.push('/login');
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
    <nav className="bg-indigo-700 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between py-3">
          <Link
            href="/dashboard"
            className="text-lg sm:text-xl font-bold tracking-tight leading-tight"
          >
            Board Game Night
          </Link>

          <div className="hidden sm:flex items-center gap-6">
            <Link
              href="/dashboard"
              className="hover:text-indigo-200 transition-colors text-sm font-medium"
            >
              Events
            </Link>
            <Link
              href="/collection"
              className="hover:text-indigo-200 transition-colors text-sm font-medium"
            >
              Collection
            </Link>
            <Link
              href="/friends"
              className="hover:text-indigo-200 transition-colors text-sm font-medium"
            >
              Friends
            </Link>
            {user?.role === 'admin' && (
              <Link
                href="/admin"
                className="hover:text-indigo-200 transition-colors text-sm font-medium"
              >
                Admin
              </Link>
            )}
            <Link
              href="/profile"
              className="hover:text-indigo-200 transition-colors text-sm font-medium"
            >
              Profile
            </Link>

            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-indigo-500">
              <span className="text-sm text-indigo-200">{user?.name}</span>
              <button
                onClick={handleLogout}
                className="text-sm bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-md transition-colors"
              >
                Logout
              </button>
            </div>
          </div>

          <button
            ref={toggleButtonRef}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="sm:hidden inline-flex items-center justify-center rounded-md p-2 hover:bg-indigo-600 transition-colors"
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
                className="hover:text-indigo-200 transition-colors text-sm font-medium py-1"
              >
                Events
              </Link>
              <Link
                href="/collection"
                onClick={() => setMenuOpen(false)}
                className="hover:text-indigo-200 transition-colors text-sm font-medium py-1"
              >
                Collection
              </Link>
              <Link
                href="/friends"
                onClick={() => setMenuOpen(false)}
                className="hover:text-indigo-200 transition-colors text-sm font-medium py-1"
              >
                Friends
              </Link>
              {user?.role === 'admin' && (
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="hover:text-indigo-200 transition-colors text-sm font-medium py-1"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="hover:text-indigo-200 transition-colors text-sm font-medium py-1"
              >
                Profile
              </Link>

              <div className="pt-2 border-t border-indigo-500/50 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-indigo-200">{user?.name}</span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="text-sm bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-md transition-colors"
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
