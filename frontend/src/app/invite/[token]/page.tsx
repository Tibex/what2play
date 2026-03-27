"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { PENDING_INVITE_STORAGE_KEY } from "@/lib/auth-flow";
import { formatEventDateTime } from "@/lib/datetime";
import type { GameEvent } from "@/lib/types";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<GameEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [currentUserId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const userRaw = localStorage.getItem("user");
    if (!userRaw) return null;
    try {
      const parsed = JSON.parse(userRaw) as { id?: string };
      return parsed?.id ?? null;
    } catch {
      return null;
    }
  });
  const [hasAuthToken] = useState(
    () =>
      typeof window !== "undefined" &&
      Boolean(localStorage.getItem("accessToken")),
  );
  const [isExistingMember, setIsExistingMember] = useState(false);

  useEffect(() => {
    api
      .get<GameEvent>(`/events/invite/${token}`, { auth: false })
      .then(setEvent)
      .catch(() => setLoadError("Invalid or expired invite link"))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!event?.id || !hasAuthToken) return;
    let cancelled = false;
    api
      .get<GameEvent[]>("/events", { showErrorToast: false })
      .then((events) => {
        if (cancelled) return;
        setIsExistingMember(
          events.some((userEvent) => userEvent.id === event.id),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setIsExistingMember(false);
      });
    return () => {
      cancelled = true;
    };
  }, [event?.id, hasAuthToken]);

  const alreadyJoinedWithAccount = Boolean(
    isExistingMember ||
    (currentUserId &&
      event?.attendees?.some((attendee) => attendee.userId === currentUserId)),
  );

  useEffect(() => {
    if (!event?.id || !alreadyJoinedWithAccount) return;
    router.replace(`/events/${event.id}`);
  }, [alreadyJoinedWithAccount, event?.id, router]);

  const handleJoin = async () => {
    const hasToken = localStorage.getItem("accessToken");
    if (!hasToken) {
      localStorage.setItem(PENDING_INVITE_STORAGE_KEY, token);
      router.push("/login");
      return;
    }
    try {
      await api.post(`/events/invite/${token}/join`);
      router.push(`/events/${event?.id}`);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to join");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{loadError}</p>
          <Link
            href="/login"
            className="text-indigo-600 hover:underline"
            onClick={() =>
              localStorage.setItem(PENDING_INVITE_STORAGE_KEY, token)
            }
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  if (!event) return null;

  const timeZone = event.eventTimezone || "UTC";
  const formatted = formatEventDateTime(event.dateTime, timeZone);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="text-4xl mb-4">🎲</div>
        <h1 className="text-2xl font-bold mb-2">You&apos;re Invited!</h1>
        <h2 className="text-xl font-semibold text-indigo-700 mb-4">
          {event.title}
        </h2>
        <p className="text-gray-600 mb-1">
          {formatted.date}
          {" at "}
          {formatted.time}
          {" · "}
          {timeZone}
        </p>
        {event.location && (
          <p className="text-gray-500 text-sm mb-1">{event.location}</p>
        )}
        {event.description && (
          <p className="text-gray-500 text-sm mt-3">{event.description}</p>
        )}
        {actionError && (
          <p className="mt-3 text-sm text-red-600">{actionError}</p>
        )}
        {alreadyJoinedWithAccount ? (
          <>
            <button
              onClick={() => router.push(`/events/${event.id}`)}
              className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
            >
              Open Event
            </button>
            <p className="text-xs text-gray-400 mt-3">
              You are already joined with this account
            </p>
          </>
        ) : (
          <>
            <button
              onClick={handleJoin}
              className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
            >
              {hasAuthToken ? "Join With Account" : "Login and Join"}
            </button>
            <p className="text-xs text-gray-400 mt-3">
              Login with your account to join this event
            </p>
          </>
        )}
      </div>
    </div>
  );
}
