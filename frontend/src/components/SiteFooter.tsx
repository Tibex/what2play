import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--paper)]">
      <div className="wt-page px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <Link href="/" className="no-underline font-bold text-sm" style={{ color: 'var(--foreground)' }}>
            What2<span style={{ color: 'var(--primary)' }}>Play</span>
          </Link>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            Stop debating. Start playing.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm" style={{ color: 'var(--muted)' }}>
          <Link href="/resources" className="no-underline transition-colors hover:text-[var(--foreground)]" style={{ color: 'inherit' }}>
            Resources
          </Link>
          <Link href="/faq" className="no-underline transition-colors hover:text-[var(--foreground)]" style={{ color: 'inherit' }}>
            FAQ
          </Link>
          <Link href="/about" className="no-underline transition-colors hover:text-[var(--foreground)]" style={{ color: 'inherit' }}>
            About
          </Link>
          <Link href="/contact" className="no-underline transition-colors hover:text-[var(--foreground)]" style={{ color: 'inherit' }}>
            Contact
          </Link>
          <Link href="/privacy" className="no-underline transition-colors hover:text-[var(--foreground)]" style={{ color: 'inherit' }}>
            Privacy
          </Link>
          <Link href="/terms" className="no-underline transition-colors hover:text-[var(--foreground)]" style={{ color: 'inherit' }}>
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
