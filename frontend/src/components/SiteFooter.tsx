import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--paper)]">
      <div className="wt-page px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm wt-muted">
        <span className="font-semibold text-[var(--foreground)]">
          <Link href="/" className="hover:text-[var(--primary)] no-underline text-[var(--foreground)]">
            What2Play
          </Link>
        </span>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link href="/resources" className="hover:text-[var(--primary)] no-underline text-[var(--muted)]">
            Resources
          </Link>
          <Link href="/faq" className="hover:text-[var(--primary)] no-underline text-[var(--muted)]">
            FAQ
          </Link>
          <Link href="/about" className="hover:text-[var(--primary)] no-underline text-[var(--muted)]">
            About
          </Link>
          <Link href="/contact" className="hover:text-[var(--primary)] no-underline text-[var(--muted)]">
            Contact
          </Link>
          <Link href="/privacy" className="hover:text-[var(--primary)] no-underline text-[var(--muted)]">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-[var(--primary)] no-underline text-[var(--muted)]">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
