'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { User, Friendship, Group } from '@/lib/types';
import { useAuthStore } from '@/lib/store';
import FriendPickerDropdown from '@/components/friends/FriendPickerDropdown';

const loadFriendsData = async () => {
  const [friends, pendingIncoming, pendingSent] = await Promise.all([
    api.get<User[]>('/friends'),
    api.get<Friendship[]>('/friends/pending'),
    api.get<Friendship[]>('/friends/pending/sent'),
  ]);
  return { friends, pendingIncoming, pendingSent };
};

export default function FriendsPage() {
  const { user } = useAuthStore();
  const [friends, setFriends] = useState<User[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState<Friendship[]>([]);
  const [pendingSent, setPendingSent] = useState<Friendship[]>([]);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupName, setGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [addingGroupMemberId, setAddingGroupMemberId] = useState<string | null>(
    null,
  );
  const [removingGroupMemberKey, setRemovingGroupMemberKey] = useState<string | null>(
    null,
  );
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const {
        friends: loadedFriends,
        pendingIncoming: loadedPendingIncoming,
        pendingSent: loadedPendingSent,
      } = await loadFriendsData();
      const loadedGroups = await api.get<Group[]>('/groups', {
        showErrorToast: false,
      });
      setFriends(loadedFriends);
      setPendingIncoming(loadedPendingIncoming);
      setPendingSent(loadedPendingSent);
      setGroups(loadedGroups);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Failed to load friends');
      setFriends([]);
      setPendingIncoming([]);
      setPendingSent([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sendRequest = async () => {
    if (!email.trim()) return;
    try {
      await api.post('/friends/request', { email });
      setMessage('Friend request sent!');
      setEmail('');
      await loadData();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Failed');
    }
  };

  const acceptRequest = async (id: string) => {
    await api.post(`/friends/${id}/accept`);
    await loadData();
  };

  const rejectRequest = async (id: string) => {
    await api.post(`/friends/${id}/reject`);
    await loadData();
  };

  const removeFriend = async (friendId: string) => {
    await api.delete(`/friends/${friendId}`);
    await loadData();
  };

  const createGroup = async () => {
    const trimmed = groupName.trim();
    if (!trimmed) return;
    setCreatingGroup(true);
    try {
      await api.post('/groups', { name: trimmed });
      setGroupName('');
      await loadData();
    } finally {
      setCreatingGroup(false);
    }
  };

  const addGroupMember = async (groupId: string, userId: string) => {
    if (!userId) return;
    setAddingGroupMemberId(groupId);
    try {
      await api.post(`/groups/${groupId}/members`, { userId });
      await loadData();
    } finally {
      setAddingGroupMemberId(null);
    }
  };

  const removeGroupMember = async (groupId: string, memberUserId: string) => {
    const key = `${groupId}:${memberUserId}`;
    setRemovingGroupMemberKey(key);
    try {
      await api.delete(`/groups/${groupId}/members/${memberUserId}`);
      await loadData();
    } finally {
      setRemovingGroupMemberKey(null);
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (!globalThis.confirm('Delete this group? This cannot be undone.')) {
      return;
    }
    setDeletingGroupId(groupId);
    try {
      await api.delete(`/groups/${groupId}`);
      await loadData();
    } finally {
      setDeletingGroupId(null);
    }
  };

  const sentPendingUsers: User[] = pendingSent
    .map((f) => f.addressee)
    .filter((user): user is User => Boolean(user));
  const acceptedFriendIds = new Set(friends.map((f) => f.id));
  const pendingOnlyUsers = sentPendingUsers.filter((u) => !acceptedFriendIds.has(u.id));
  const hasAnyConnections = friends.length > 0 || pendingOnlyUsers.length > 0;

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--primary)]" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4">
      <h1 className="text-xl sm:text-2xl font-bold mb-4">Friends</h1>

      <div className="wt-card mb-6 p-4 sm:p-6">
        <h2 className="font-semibold mb-3">Add Friend</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Friend's email address"
            className="wt-input flex-1 py-2 text-sm"
          />
          <button onClick={sendRequest} className="wt-btn wt-btn-primary px-3 py-2 text-sm font-medium">
            Send Request
          </button>
        </div>
        {message && <p className="mt-2 text-sm text-[#3f6a3f]">{message}</p>}
      </div>

      {pendingIncoming.length > 0 && (
        <div className="mb-6 rounded-2xl border border-[#d8ba7a] bg-[#f9f0dc] p-4 sm:p-6">
          <h2 className="font-semibold mb-3">Incoming Requests ({pendingIncoming.length})</h2>
          <div className="space-y-3">
            {pendingIncoming.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-lg border border-[#d8ba7a] bg-[var(--paper)] p-3">
                <span className="font-medium">{f.requester?.name || f.requester?.email}</span>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <button onClick={() => acceptRequest(f.id)} className="wt-btn rounded border border-[#afc6a1] bg-[#dbe8d3] px-3 py-1 text-sm text-[#355f39]">
                    Accept
                  </button>
                  <button onClick={() => rejectRequest(f.id)} className="wt-btn rounded border border-[#ddb5ae] bg-[#efd8d3] px-3 py-1 text-sm text-[#8a4137]">
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasAnyConnections ? (
        <div>
          <h2 className="wt-muted mb-4 font-semibold">
            Your Friends ({friends.length + pendingOnlyUsers.length})
          </h2>
          <div className="space-y-3">
            {friends.map((f) => (
              <div
                key={f.id}
                className="wt-card flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-soft)] font-bold text-[var(--primary)]">
                    {(f.name || f.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{f.name || f.email}</p>
                    <p className="text-xs text-gray-500">{f.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFriend(f.id)}
                  className="text-lg leading-none text-red-500 hover:text-red-700 transition"
                  title="Remove friend"
                  aria-label="Remove friend"
                >
                  ×
                </button>
              </div>
            ))}
            {pendingOnlyUsers.map((u) => (
              <div
                key={`pending-${u.id}`}
                className="wt-card flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-soft)] font-bold text-[var(--primary)]">
                    {(u.name || u.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{u.name || u.email}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </div>
                </div>
                <span
                  className="inline-flex items-center justify-center text-amber-600"
                  title="Request pending"
                  aria-label="Request pending"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm.75 3.25a.75.75 0 0 0-1.5 0v4a.75.75 0 0 0 .3.6l2.5 1.875a.75.75 0 1 0 .9-1.2l-2.2-1.65V5.75Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="wt-muted py-10 text-center">
          {pendingIncoming.length > 0 || pendingSent.length > 0
            ? 'No accepted friends yet.'
            : 'No friends yet. Send a friend request above.'}
        </p>
      )}

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">Groups</h2>
        <div className="wt-card mb-4 p-4 sm:p-6">
          <h3 className="font-semibold mb-3">Create Group</h3>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Create group name"
              className="wt-input flex-1 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void createGroup()}
              disabled={creatingGroup}
              className="wt-btn wt-btn-primary px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {creatingGroup ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </div>

        <h3 className="wt-muted mb-3 font-semibold">Your groups ({groups.length})</h3>
        {groups.length === 0 ? (
          <p className="wt-muted text-sm">No groups yet.</p>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => {
              const availableFriends = friends.filter(
                (friend) =>
                  !group.members?.some((member) => member.userId === friend.id),
              );
              return (
                <div key={group.id} className="wt-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-soft)] font-bold text-[var(--primary)]">
                        {group.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{group.name}</p>
                        <p className="wt-muted text-xs">
                          {group.members?.length ?? 0} members
                        </p>
                      </div>
                    </div>
                    {group.ownerId === user?.id ? (
                      <button
                        type="button"
                        onClick={() => void deleteGroup(group.id)}
                        disabled={deletingGroupId === group.id}
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        title="Delete group"
                        aria-label="Delete group"
                      >
                        {deletingGroupId === group.id ? (
                          '…'
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-4 w-4"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M8.75 2.75a1.25 1.25 0 0 1 2.5 0V3h3.5a.75.75 0 0 1 0 1.5h-.69l-.62 10.03A2 2 0 0 1 11.45 16.5h-2.9a2 2 0 0 1-1.99-1.97L5.94 4.5h-.69a.75.75 0 0 1 0-1.5h3.5v-.25Zm-.81 1.75.61 9.95a.5.5 0 0 0 .5.49h2.9a.5.5 0 0 0 .5-.49l.61-9.95H7.94Z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                    ) : null}
                  </div>
                  <ul className="mt-3 space-y-2">
                    {(group.members || []).map((member) => {
                      const removeKey = `${group.id}:${member.userId}`;
                      const canRemove = member.role !== 'owner';
                      return (
                        <li
                          key={member.id}
                          className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm"
                        >
                          <span>{member.user?.name || member.user?.email || member.userId}</span>
                          {canRemove ? (
                            <button
                              type="button"
                              onClick={() =>
                                void removeGroupMember(group.id, member.userId)
                              }
                              disabled={removingGroupMemberKey === removeKey}
                              className="inline-flex h-6 w-6 items-center justify-center rounded text-red-600 hover:bg-red-50 disabled:opacity-50"
                              title="Remove member"
                              aria-label="Remove member"
                            >
                              {removingGroupMemberKey === removeKey ? '…' : '×'}
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-3">
                    <FriendPickerDropdown
                      friends={availableFriends}
                      loading={addingGroupMemberId === group.id}
                      onSelect={(friendId) => {
                        void addGroupMember(group.id, friendId);
                      }}
                      buttonTitle="Add friend to group"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
