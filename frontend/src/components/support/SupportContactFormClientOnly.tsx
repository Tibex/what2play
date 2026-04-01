'use client';

import dynamic from 'next/dynamic';

const SupportContactForm = dynamic(
  () => import('@/components/support/SupportContactForm'),
  {
    ssr: false,
    loading: () => (
      <div className="wt-card p-6">
        <h2 className="text-2xl font-semibold">Loading support form...</h2>
        <p className="mt-3 text-sm wt-muted">
          Please wait a moment.
        </p>
      </div>
    ),
  },
);

export default function SupportContactFormClientOnly() {
  return <SupportContactForm />;
}
