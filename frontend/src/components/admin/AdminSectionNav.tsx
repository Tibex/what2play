'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/admin/overview', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/catalog', label: 'Catalog' },
];

export default function AdminSectionNav() {
  const pathname = usePathname();

  return (
    <aside className="rounded-xl border border-[var(--border)] bg-[var(--paper)] p-3">
      <p className="mb-2 text-xs uppercase tracking-wide wt-muted">Admin</p>
      <nav className="flex flex-col gap-1">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-2 text-sm ${
                active
                  ? 'bg-[var(--surface)] text-[var(--foreground)] font-semibold'
                  : 'wt-muted hover:bg-[var(--surface)]'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
