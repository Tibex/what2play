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

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Friends</h1>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <h2 className="font-semibold mb-3">Add Friend</h2>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Friend's email address"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button onClick={sendRequest} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
            Send Request
          </button>
        </div>
        {message && <p className="text-sm text-green-600 mt-2">{message}</p>}
      </div>

      {pendingIncoming.length > 0 && (
        <div className="bg-yellow-50 rounded-2xl border border-yellow-100 p-6 mb-6">
          <h2 className="font-semibold mb-3">Incoming Requests ({pendingIncoming.length})</h2>
          <div className="space-y-3">
            {pendingIncoming.map((f) => (
              <div key={f.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-yellow-200">
                <span className="font-medium">{f.requester?.name || f.requester?.email}</span>
                <div className="flex gap-2">
                  <button onClick={() => acceptRequest(f.id)} className="bg-green-100 text-green-700 px-3 py-1 rounded text-sm hover:bg-green-200 transition">
                    Accept
                  </button>
                  <button onClick={() => rejectRequest(f.id)} className="bg-red-100 text-red-700 px-3 py-1 rounded text-sm hover:bg-red-200 transition">
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingSent.length > 0 && (
        <div className="bg-blue-50 rounded-2xl border border-blue-100 p-6 mb-6">
          <h2 className="font-semibold mb-3">Sent Requests ({pendingSent.length})</h2>
          <div className="space-y-3">
            {pendingSent.map((f) => (
              <div key={f.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-blue-200">
                <span className="font-medium">
                  {f.addressee?.name || f.addressee?.email}
                </span>
                <span className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                  Pending
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {friends.length === 0 ? (
        <p className="text-gray-500 text-center py-10">
          {pendingIncoming.length > 0 || pendingSent.length > 0
            ? 'No accepted friends yet.'
            : 'No friends yet. Send a friend request above.'}
        </p>
      ) : (
        <div>
          <h2 className="font-semibold text-gray-700 mb-4">Your Friends ({friends.length})</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {friends.map((f) => (
              <div key={f.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                    {f.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{f.name}</p>
                    <p className="text-xs text-gray-500">{f.email}</p>
                  </div>
                </div>
                <button onClick={() => removeFriend(f.id)} className="text-xs text-red-500 hover:text-red-700 transition">
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
