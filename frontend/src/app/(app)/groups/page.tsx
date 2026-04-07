'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { Group, User } from '@/lib/types';

export default function GroupsPage() {
  const { user } = useAuthStore();
  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedFriendByGroup, setSelectedFriendByGroup] = useState<
    Record<string, string>
  >({});
  const [roleByGroup, setRoleByGroup] = useState<Record<string, 'member' | 'admin'>>(
    {},
  );
  const [addingToGroupId, setAddingToGroupId] = useState<string | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  const loadGroups = async () => {
    const rows = await api.get<Group[]>('/groups');
    setGroups(rows);
  };

  useEffect(() => {
    Promise.all([
      loadGroups(),
      api.get<User[]>('/friends', { showErrorToast: false }).then(setFriends),
    ])
      .catch(() => {
        toast.error('Failed to load groups/friends');
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

  const addMember = async (groupId: string) => {
    const friendId = selectedFriendByGroup[groupId];
    if (!friendId) return;
    setAddingToGroupId(groupId);
    try {
      await api.post(`/groups/${groupId}/members`, {
        userId: friendId,
        role: roleByGroup[groupId] ?? 'member',
      });
      await loadGroups();
      setSelectedFriendByGroup((prev) => ({ ...prev, [groupId]: '' }));
      toast.success('Member added');
    } finally {
      setAddingToGroupId(null);
    }
  };

  const removeMember = async (groupId: string, memberUserId: string) => {
    const key = `${groupId}:${memberUserId}`;
    setRemovingKey(key);
    try {
      await api.delete(`/groups/${groupId}/members/${memberUserId}`);
      await loadGroups();
      toast.success('Member removed');
    } finally {
      setRemovingKey(null);
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
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Members
                  </p>
                  <ul className="space-y-1">
                    {(group.members || []).map((member) => {
                      const canRemove =
                        member.userId !== user?.id && member.role !== 'owner';
                      const removeBusy =
                        removingKey === `${group.id}:${member.userId}`;
                      return (
                        <li
                          key={member.id}
                          className="flex items-center justify-between rounded border border-[var(--border)] px-2 py-1.5 text-sm"
                        >
                          <span>
                            {member.user?.name || member.user?.email || member.userId}
                            <span className="wt-muted ml-2 text-xs">({member.role})</span>
                          </span>
                          {canRemove ? (
                            <button
                              type="button"
                              onClick={() => void removeMember(group.id, member.userId)}
                              disabled={removeBusy}
                              className="text-xs text-[var(--danger)] disabled:opacity-50"
                            >
                              {removeBusy ? 'Removing...' : 'Remove'}
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
                  <select
                    value={selectedFriendByGroup[group.id] || ''}
                    onChange={(e) =>
                      setSelectedFriendByGroup((prev) => ({
                        ...prev,
                        [group.id]: e.target.value,
                      }))
                    }
                    className="wt-input text-sm"
                  >
                    <option value="">Add friend...</option>
                    {friends
                      .filter(
                        (friend) =>
                          !(group.members || []).some(
                            (member) => member.userId === friend.id,
                          ),
                      )
                      .map((friend) => (
                        <option key={friend.id} value={friend.id}>
                          {friend.name || friend.email}
                        </option>
                      ))}
                  </select>
                  <select
                    value={roleByGroup[group.id] || 'member'}
                    onChange={(e) =>
                      setRoleByGroup((prev) => ({
                        ...prev,
                        [group.id]: e.target.value as 'member' | 'admin',
                      }))
                    }
                    className="wt-input text-sm"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void addMember(group.id)}
                    disabled={
                      addingToGroupId === group.id || !selectedFriendByGroup[group.id]
                    }
                    className="wt-btn wt-btn-secondary px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {addingToGroupId === group.id ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
