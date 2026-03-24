'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { User } from '@/lib/types';

export default function ProfilePage() {
  const { user: authUser } = useAuthStore();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    name: '',
    timezone: '',
    preferredDuration: 0,
    preferredWeight: 0,
  });

  useEffect(() => {
    api.get<User>('/users/me').then((u) => {
      setProfile(u);
      setForm({
        name: u.name || '',
        timezone: u.timezone || '',
        preferredDuration: u.preferredDuration || 0,
        preferredWeight: u.preferredWeight || 0,
      });
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await api.patch('/users/me', form);
      setMessage('Profile updated!');
    } catch {
      setMessage('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
          <input
            type="text"
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            placeholder="e.g., Europe/Budapest"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Game Duration (min)</label>
            <input
              type="number"
              value={form.preferredDuration}
              onChange={(e) => setForm({ ...form, preferredDuration: Number(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Complexity (1-5)</label>
            <input
              type="number"
              value={form.preferredWeight}
              onChange={(e) => setForm({ ...form, preferredWeight: Number(e.target.value) })}
              min={1}
              max={5}
              step={0.1}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        {message && <p className={`text-sm ${message.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>{message}</p>}

        <button onClick={handleSave} disabled={saving} className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
