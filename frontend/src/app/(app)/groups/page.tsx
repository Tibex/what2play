'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import type { Group } from '@/lib/types';

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadGroups = async () => {
    const rows = await api.get<Group[]>('/groups');
    setGroups(rows);
  };

  useEffect(() => {
    loadGroups()
      .catch(() => {
        toast.error('Failed to load groups');
      })
      .finally(() => setLoading(false));
  }, []);

  const createGroup = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await api.post('/groups', {
        name: trimmed,
        description: description.trim() || undefined,
      });
      setName('');
      setDescription('');
      await loadGroups();
      toast.success('Group created');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Groups</h1>
      <div className="wt-card space-y-3 p-4">
        <h2 className="font-semibold">Create recurring group</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="wt-input"
          placeholder="Friday Crew"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="wt-input"
          rows={2}
          placeholder="Optional description"
        />
        <button
          type="button"
          onClick={() => void createGroup()}
          disabled={creating}
          className="wt-btn wt-btn-primary px-4 py-2 text-sm disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create group'}
        </button>
      </div>

      <div className="wt-card p-4">
        <h2 className="mb-3 font-semibold">Your groups</h2>
        {loading ? (
          <p className="wt-muted text-sm">Loading...</p>
        ) : groups.length === 0 ? (
          <p className="wt-muted text-sm">No groups yet.</p>
        ) : (
          <ul className="space-y-2">
            {groups.map((group) => (
              <li
                key={group.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--paper)] p-3"
              >
                <p className="font-medium">{group.name}</p>
                {group.description ? (
                  <p className="wt-muted text-sm">{group.description}</p>
                ) : null}
                <p className="wt-muted mt-1 text-xs">
                  {group.members?.length ?? 0} members
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
