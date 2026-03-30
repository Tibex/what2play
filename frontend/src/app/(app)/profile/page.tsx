'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import type { SyncAccount, User } from '@/lib/types';

const DURATION_OPTIONS = [60, 120, 180, 240, 300, 360];
const WEIGHT_OPTIONS = ['1', '2', '3', '4', '5'];
const BGG_CONTROL_HEIGHT_CLASS = 'h-[46px]';

function durationLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<User | null>(null);
  const [bggAccount, setBggAccount] = useState<SyncAccount | null>(null);
  const [bggUsername, setBggUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');

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
        setProfile(u);
        setBggAccount(linked);
        setBggUsername(linked?.externalUsername || '');
        setForm({
          name: u.name || '',
          preferredDuration: u.preferredDuration || 180,
          preferredWeight: String(u.preferredWeight || '2.5'),
        });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await api.patch('/users/me', {
        ...form,
        preferredDuration: Number(form.preferredDuration),
        preferredWeight: Number(form.preferredWeight),
      });
      setMessage('Profile updated!');
    } catch {
      setMessage('Failed to update');
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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Profile</h1>
      <div className="bg-white rounded-2xl border border-gray-100 p-8 space-y-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-2xl font-bold">
            {profile?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-lg">{profile?.name}</p>
            <p className="text-sm text-gray-500">{profile?.email}</p>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{profile?.subscriptionTier}</span>
          </div>
        </div>

        <div>
          <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
          <input
            id="profile-name"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition"
            >
              {WEIGHT_OPTIONS.map((weight) => (
                <option key={weight} value={weight}>
                  {weight}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5 space-y-3">
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
                className={`w-full border border-gray-300 rounded-lg px-3 ${BGG_CONTROL_HEIGHT_CLASS} focus:ring-2 focus:ring-indigo-500 outline-none transition`}
              />
            </div>
            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={syncing}
              className={`${BGG_CONTROL_HEIGHT_CLASS} px-4 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:border-indigo-300 disabled:opacity-50 transition`}
            >
              {syncing ? 'Syncing...' : 'Sync now'}
            </button>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="text-gray-600">
              {bggAccount ? (
                <>
                  Linked as <span className="font-medium">{bggAccount.externalUsername}</span>
                  {bggAccount.lastSyncedAt ? (
                    <span className="text-gray-500">
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

        {message && (
          <p
            className={`text-sm ${message.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}
          >
            {message}
          </p>
        )}

        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
