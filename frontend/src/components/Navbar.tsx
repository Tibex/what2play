'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!isAuthenticated) return null;

  return (
    <nav className="bg-indigo-700 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link href="/dashboard" className="text-xl font-bold tracking-tight">
            Board Game Night
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="hover:text-indigo-200 transition-colors text-sm font-medium">
              Events
            </Link>
            <Link href="/collection" className="hover:text-indigo-200 transition-colors text-sm font-medium">
              Collection
            </Link>
            <Link href="/friends" className="hover:text-indigo-200 transition-colors text-sm font-medium">
              Friends
            </Link>
            {user?.role === 'admin' && (
              <Link href="/admin" className="hover:text-indigo-200 transition-colors text-sm font-medium">
                Admin
              </Link>
            )}
            <Link href="/profile" className="hover:text-indigo-200 transition-colors text-sm font-medium">
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
        </div>
      </div>
    </nav>
  );
}
