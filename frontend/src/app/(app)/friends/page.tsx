'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { User, Friendship } from '@/lib/types';

const loadFriendsData = async () => {
  const [friends, pendingIncoming, pendingSent] = await Promise.all([
    api.get<User[]>('/friends'),
    api.get<Friendship[]>('/friends/pending'),
    api.get<Friendship[]>('/friends/pending/sent'),
  ]);
  return { friends, pendingIncoming, pendingSent };
};

export default function FriendsPage() {
  const [friends, setFriends] = useState<User[]>([]);
  const [pendingIncoming, setPendingIncoming] = useState<Friendship[]>([]);
  const [pendingSent, setPendingSent] = useState<Friendship[]>([]);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const {
      friends: loadedFriends,
      pendingIncoming: loadedPendingIncoming,
      pendingSent: loadedPendingSent,
    } = await loadFriendsData();
    setFriends(loadedFriends);
    setPendingIncoming(loadedPendingIncoming);
    setPendingSent(loadedPendingSent);
    setLoading(false);
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, []);

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
    loadData();
  };

  const rejectRequest = async (id: string) => {
    await api.post(`/friends/${id}/reject`);
    loadData();
  };

  const removeFriend = async (friendId: string) => {
    await api.delete(`/friends/${friendId}`);
    loadData();
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
                    {f.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{f.name}</p>
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
    </div>
  );
}
