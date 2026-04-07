'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from '@/lib/types';

type FriendPickerDropdownProps = Readonly<{
  friends: User[];
  loading?: boolean;
  onOpen?: () => void | Promise<void>;
  onSelect: (friendId: string) => void;
  buttonTitle?: string;
}>;

export default function FriendPickerDropdown({
  friends,
  loading = false,
  onOpen,
  onSelect,
  buttonTitle = 'Add friend',
}: FriendPickerDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocumentClick);
    return () => {
      document.removeEventListener('mousedown', onDocumentClick);
    };
  }, []);

  const visibleFriends = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (friend) =>
        friend.name.toLowerCase().includes(q) ||
        friend.email.toLowerCase().includes(q),
    );
  }, [friends, query]);

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    await onOpen?.();
  };

  let content: ReactNode;
  if (loading) {
    content = <p className="px-1 py-2 text-xs text-gray-500">Loading...</p>;
  } else if (visibleFriends.length === 0) {
    content = <p className="px-1 py-2 text-xs text-gray-500">No matching friends</p>;
  } else {
    content = visibleFriends.map((friend) => (
      <button
        key={friend.id}
        type="button"
        onClick={() => {
          onSelect(friend.id);
          setOpen(false);
          setQuery('');
        }}
        className="w-full rounded px-2 py-1.5 text-left hover:bg-gray-100"
      >
        <span className="block truncate text-sm text-gray-800">
          {friend.name || friend.email}
        </span>
        <span className="block truncate text-xs text-gray-500">
          {friend.email}
        </span>
      </button>
    ));
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => {
          void toggle();
        }}
        className="wt-btn wt-btn-secondary rounded-full px-3 py-1 text-sm font-medium"
        title={buttonTitle}
        aria-label={buttonTitle}
      >
        +
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-2 w-[calc(100vw-2rem)] rounded-lg border border-(--border) bg-(--paper) p-2 shadow-(--shadow-soft) sm:w-72">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search friends..."
            className="wt-input mb-2 w-full rounded-md px-2 py-1.5 text-sm"
          />
          <div className="max-h-56 overflow-y-auto">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}
