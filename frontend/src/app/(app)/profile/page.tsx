'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import type { CalendarAccount, SyncAccount, User } from '@/lib/types';

const DURATION_OPTIONS = [60, 120, 180, 240, 300, 360];
const WEIGHT_OPTIONS = ['1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0'];
const BGG_CONTROL_HEIGHT_CLASS = 'h-[46px]';
const APPLE_CALENDAR_AVAILABLE = false;

function durationLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

function normalizeWeightForForm(value: unknown): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '2.5';
  const clamped = Math.min(5, Math.max(1, parsed));
  return clamped.toFixed(1);
}

export default function ProfilePage() {
  const params = useSearchParams();
  const router = useRouter();
  const [profile, setProfile] = useState<User | null>(null);
  const [bggAccount, setBggAccount] = useState<SyncAccount | null>(null);
  const [bggUsername, setBggUsername] = useState('');
  const [calendarAccounts, setCalendarAccounts] = useState<CalendarAccount[]>([]);
  const [calendarBusyProvider, setCalendarBusyProvider] = useState<
    'google' | 'apple' | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [form, setForm] = useState({
    name: '',
    preferredDuration: 180,
    preferredWeight: '2.5',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [u, linked] = await Promise.all([
          api.get<User>('/users/me'),
          api.get<SyncAccount | null>('/bgg/link', { showErrorToast: false }),
        ]);
        const connectedCalendars = await api.get<CalendarAccount[]>(
          '/calendar/accounts',
          { showErrorToast: false },
        );
        setProfile(u);
        setBggAccount(linked);
        setCalendarAccounts(connectedCalendars);
        setBggUsername(linked?.externalUsername || '');
        setForm({
          name: u.name || '',
          preferredDuration: u.preferredDuration || 180,
          preferredWeight: normalizeWeightForForm(u.preferredWeight),
        });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    const status = params.get('calendarConnect');
    const provider = params.get('provider');
    if (!status || provider !== 'google') return;
    if (status === 'success') {
      toast.success('Google Calendar connected');
      void refreshCalendarAccounts();
    } else {
      const reason = params.get('reason') || 'unknown';
      toast.error(`Google Calendar connect failed (${reason})`);
    }
    const clean = new URLSearchParams(params.toString());
    clean.delete('calendarConnect');
    clean.delete('provider');
    clean.delete('reason');
    const next = clean.toString();
    router.replace(next ? `/profile?${next}` : '/profile');
  }, [params, router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.patch<User>('/users/me', {
        ...form,
        preferredDuration: Number(form.preferredDuration),
        preferredWeight: Number(form.preferredWeight),
      });
      setProfile(updated);
      setForm({
        name: updated.name || '',
        preferredDuration: updated.preferredDuration || 180,
        preferredWeight: normalizeWeightForForm(updated.preferredWeight),
      });
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const unlinkBgg = async () => {
    setUnlinking(true);
    try {
      await api.delete('/bgg/link');
      setBggAccount(null);
      setBggUsername('');
      toast.success('BGG account unlinked');
    } finally {
      setUnlinking(false);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      if (!bggAccount) {
        const username = bggUsername.trim();
        if (!username) {
          toast.error('Enter your BoardGameGeek username');
          return;
        }
        await api.post<SyncAccount>('/bgg/link', { bggUsername: username });
      }
      const result = await api.post<{ imported: number; fetched: number }>('/bgg/sync');
      setBggAccount(await api.get<SyncAccount | null>('/bgg/link', { showErrorToast: false }));
      toast.success(`Synced ${result.imported}/${result.fetched} games`);
    } finally {
      setSyncing(false);
    }
  };

  const isProviderConnected = (provider: 'google' | 'apple') =>
    calendarAccounts.some(
      (account) => account.provider === provider && account.status === 'linked',
    );

  const refreshCalendarAccounts = async () => {
    const connected = await api.get<CalendarAccount[]>('/calendar/accounts', {
      showErrorToast: false,
    });
    setCalendarAccounts(connected);
  };

  const connectCalendar = async (provider: 'google' | 'apple') => {
    if (provider === 'apple') {
      toast('Apple Calendar sync is not available yet');
      return;
    }
    if (provider === 'google') {
      setCalendarBusyProvider(provider);
      try {
        const response = await api.get<{ url: string }>('/calendar/google/auth-url');
        if (!response.url) {
          toast.error('Failed to start Google calendar connect');
          return;
        }
        window.location.href = response.url;
      } finally {
        setCalendarBusyProvider(null);
      }
      return;
    }
  };

  const disconnectCalendar = async (provider: 'google' | 'apple') => {
    setCalendarBusyProvider(provider);
    try {
      await api.post(`/calendar/disconnect/${provider}`);
      await refreshCalendarAccounts();
      toast.success(
        `${provider === 'google' ? 'Google' : 'Apple'} calendar disconnected`,
      );
    } finally {
      setCalendarBusyProvider(null);
    }
  };

  const availableProviders = ['google', 'apple'] as const;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Profile</h1>
      <div className="wt-card space-y-5 p-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary-soft)] text-2xl font-bold text-[var(--primary)]">
            {profile?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-lg">{profile?.name}</p>
            <p className="wt-muted text-sm">{profile?.email}</p>
            <span className="wt-chip border-[var(--border-strong)] bg-[var(--primary-soft)] text-[var(--primary)]">{profile?.subscriptionTier}</span>
          </div>
        </div>

        <div>
          <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
          <input
            id="profile-name"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="wt-input"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="profile-duration" className="block text-sm font-medium text-gray-700 mb-1">Preferred Game Duration (min)</label>
            <select
              id="profile-duration"
              value={form.preferredDuration}
              onChange={(e) =>
                setForm({ ...form, preferredDuration: Number(e.target.value) })
              }
              className="wt-input"
            >
              {DURATION_OPTIONS.map((mins) => (
                <option key={mins} value={mins}>
                  {durationLabel(mins)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="profile-weight" className="block text-sm font-medium text-gray-700 mb-1">Preferred Complexity (1-5)</label>
            <select
              id="profile-weight"
              value={form.preferredWeight}
              onChange={(e) => setForm({ ...form, preferredWeight: e.target.value })}
              className="wt-input"
            >
              {WEIGHT_OPTIONS.map((weight) => (
                <option key={weight} value={weight}>
                  {Number(weight).toFixed(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3 border-t border-[var(--border)] pt-5">
          <h2 className="font-semibold text-gray-800">BoardGameGeek</h2>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <label htmlFor="profile-bgg-username" className="block text-sm font-medium text-gray-700 mb-1">
                BGG Username
              </label>
              <input
                id="profile-bgg-username"
                type="text"
                value={bggUsername}
                onChange={(e) => setBggUsername(e.target.value)}
                placeholder="your_bgg_username"
                className={`wt-input w-full px-3 ${BGG_CONTROL_HEIGHT_CLASS}`}
              />
            </div>
            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={syncing}
              className={`wt-btn wt-btn-secondary ${BGG_CONTROL_HEIGHT_CLASS} px-4 text-sm font-medium disabled:opacity-50`}
            >
              {syncing ? 'Syncing...' : 'Sync now'}
            </button>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="wt-muted">
              {bggAccount ? (
                <>
                  Linked as <span className="font-medium">{bggAccount.externalUsername}</span>
                  {bggAccount.lastSyncedAt ? (
                    <span className="wt-muted">
                      {' '}
                      • Last sync: {new Date(bggAccount.lastSyncedAt).toLocaleString()}
                    </span>
                  ) : null}
                </>
              ) : (
                'No BGG account linked'
              )}
            </div>
            {bggAccount ? (
              <button
                type="button"
                onClick={() => void unlinkBgg()}
                disabled={unlinking}
                className="text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {unlinking ? 'Unlinking...' : 'Unlink'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 border-t border-[var(--border)] pt-5">
          <h2 className="font-semibold text-gray-800">Calendar sync</h2>
          <p className="wt-muted text-sm">
            Google Calendar is available now. Apple Calendar sync is currently
            disabled until beta implementation is completed.
          </p>
          <div className="grid grid-cols-1 gap-3">
            {availableProviders.map((provider) => {
              const connected = isProviderConnected(provider);
              const providerDisabled =
                provider === 'apple' && !APPLE_CALENDAR_AVAILABLE;
              const busy = calendarBusyProvider === provider || providerDisabled;
              return (
                <div
                  key={provider}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--paper)] p-3"
                >
                  <div>
                    <p className="font-medium">
                      <span className="mr-1" aria-hidden="true">
                        {provider === 'google' ? '🗓️' : '📆'}
                      </span>
                      {provider === 'google' ? 'Google Calendar' : 'Apple Calendar'}
                    </p>
                    <p className="wt-muted text-xs">
                      {connected
                        ? 'Connected'
                        : providerDisabled
                          ? 'Coming soon'
                          : 'Not connected'}
                    </p>
                  </div>
                  {connected ? (
                    <button
                      type="button"
                      onClick={() => void disconnectCalendar(provider)}
                      disabled={busy}
                      className="wt-btn rounded-lg border border-[#ddb5ae] px-3 py-1.5 text-sm text-[var(--danger)] disabled:opacity-50"
                    >
                      {busy ? '...' : 'Disconnect'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void connectCalendar(provider)}
                      disabled={busy}
                      className="wt-btn wt-btn-secondary px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      {providerDisabled ? 'Coming soon' : busy ? '...' : 'Connect'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="wt-btn wt-btn-primary w-full py-2.5 font-medium disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
