'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/api';

type TicketResponse = {
  ticketId: string;
  message: string;
};

export default function SupportContactForm() {
  const supportEmail =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@what2play.games';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [ticketId, setTicketId] = useState('');

  const canSubmit = useMemo(
    () =>
      !submitting &&
      name.trim().length >= 2 &&
      email.trim().length > 3 &&
      subject.trim().length >= 4 &&
      message.trim().length >= 20,
    [name, email, subject, message, submitting],
  );

  const resetForm = () => {
    setName('');
    setEmail('');
    setSubject('');
    setMessage('');
    setWebsite('');
    setError('');
    setTicketId('');
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError('');
    try {
      const sourceUrl =
        typeof window !== 'undefined' ? window.location.href : '/contact';
      const result = await api.post<TicketResponse>(
        '/support/tickets',
        {
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
          website: website.trim(),
          sourceUrl,
        },
        { auth: false, showErrorToast: false },
      );
      setTicketId(result.ticketId);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not submit your ticket. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (ticketId) {
    return (
      <div className="wt-card p-6">
        <h2 className="text-2xl font-semibold">Ticket received</h2>
        <p className="mt-3 wt-muted leading-relaxed">
          Your request was submitted successfully.
        </p>
        <p className="mt-3 text-sm">
          Ticket ID:{' '}
          <span className="font-semibold text-[var(--foreground)]">
            {ticketId}
          </span>
        </p>
        <p className="mt-3 text-sm wt-muted">
          If needed, you can also email{' '}
          <a
            href={`mailto:${supportEmail}`}
            className="text-[var(--primary)] hover:underline"
          >
            {supportEmail}
          </a>
          .
        </p>
        <button
          type="button"
          onClick={resetForm}
          className="mt-5 wt-btn wt-btn-secondary px-4 py-2"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="wt-card p-6 space-y-4">
      <h2 className="text-2xl font-semibold">Send a support request</h2>
      <p className="text-sm wt-muted">
        Include clear steps and expected behavior so we can help faster.
      </p>

      {error ? (
        <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="support-name" className="block text-sm font-medium mb-1">
            Name
          </label>
          <input
            id="support-name"
            className="wt-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoComplete="name"
            data-lpignore="true"
            required
          />
        </div>
        <div>
          <label htmlFor="support-email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="support-email"
            type="email"
            className="wt-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
            autoComplete="email"
            data-lpignore="true"
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="support-subject" className="block text-sm font-medium mb-1">
          Subject
        </label>
        <input
          id="support-subject"
          className="wt-input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={120}
          autoComplete="off"
          data-lpignore="true"
          required
        />
      </div>

      <div>
        <label htmlFor="support-message" className="block text-sm font-medium mb-1">
          Message
        </label>
        <textarea
          id="support-message"
          className="wt-input min-h-36"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={4000}
          autoComplete="off"
          data-lpignore="true"
          required
        />
      </div>

      <div className="hidden" aria-hidden="true">
        <label htmlFor="support-website">Website</label>
        <input
          id="support-website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          name="website"
          autoComplete="off"
          data-lpignore="true"
          tabIndex={-1}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="wt-btn wt-btn-primary px-5 py-2.5 text-white disabled:opacity-60"
          disabled={!canSubmit}
        >
          {submitting ? 'Submitting...' : 'Submit ticket'}
        </button>
        <p className="text-sm wt-muted">
          Prefer email?{' '}
          <a
            href={`mailto:${supportEmail}`}
            className="text-[var(--primary)] hover:underline"
          >
            {supportEmail}
          </a>
        </p>
      </div>
    </form>
  );
}
