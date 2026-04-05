'use client';

import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import type { EventScheduleAnswer, EventScheduleDetail } from '@/lib/types';
import { formatEventDateTime } from '@/lib/datetime';
import EventScheduleResultsPanel from '@/components/events/EventScheduleResultsPanel';

type EventScheduleBlockProps = {
  eventId: string;
  detail: EventScheduleDetail | null;
  loading: boolean;
  currentUserId: string | undefined;
  onReload: () => void | Promise<void>;
};

export default function EventScheduleBlock({
  eventId,
  detail,
  loading,
  currentUserId,
  onReload,
}: Readonly<EventScheduleBlockProps>) {
  const [savingAnswerSlotId, setSavingAnswerSlotId] = useState<string | null>(
    null,
  );
  const [finalizingId, setFinalizingId] = useState<string | null>(null);

  const formatSlotLabel = useCallback(
    (slot: EventScheduleDetail['slots'][0]) => {
      const tz = detail?.eventTimezone || 'UTC';
      const { date, time } = formatEventDateTime(slot.start, tz);
      const dm = detail?.durationMinutes ?? 180;
      const start = new Date(slot.start);
      const end = new Date(start.getTime() + dm * 60_000);
      const endTime = end.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: tz,
      });
      const label = slot.label?.trim();
      return label ? `${label} · ${date} · ${time}–${endTime}` : `${date} · ${time}–${endTime}`;
    },
    [detail?.durationMinutes, detail?.eventTimezone],
  );

  const setAnswer = async (slotId: string, answer: EventScheduleAnswer) => {
    if (!detail) return;
    if (savingAnswerSlotId !== null) return;
    if (detail.myResponses[slotId] === answer) return;
    setSavingAnswerSlotId(slotId);
    try {
      await api.patch(`/events/${eventId}/schedule/responses`, {
        responses: { [slotId]: answer },
      });
      await onReload();
    } catch {
      toast.error('Could not update availability');
    } finally {
      setSavingAnswerSlotId((current) => (current === slotId ? null : current));
    }
  };

  const finalize = async (slotId: string) => {
    setFinalizingId(slotId);
    try {
      await api.post(`/events/${eventId}/schedule/finalize`, {
        winningSlotId: slotId,
      });
      toast.success('Date set — game night is now in planning');
      await onReload();
    } catch {
      toast.error('Could not finalize this time');
    } finally {
      setFinalizingId(null);
    }
  };

  if (loading || !detail) {
    return (
      <div className="wt-card p-6 text-sm text-[var(--muted)]">Loading availability…</div>
    );
  }

  return (
    <div className="space-y-3">
      <EventScheduleResultsPanel
        detail={detail}
        currentUserId={currentUserId}
        formatSlotLabel={formatSlotLabel}
        onSetAnswer={(slotId, answer) => {
          void setAnswer(slotId, answer);
        }}
        savingAnswerSlotId={savingAnswerSlotId}
        onFinalizeSlot={
          detail.isHost
            ? (slotId: string) => {
                void finalize(slotId);
              }
            : undefined
        }
        finalizingSlotId={finalizingId}
      />
    </div>
  );
}
