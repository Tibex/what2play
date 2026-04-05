'use client';

import type { EventScheduleAnswer, EventScheduleDetail } from '@/lib/types';
import { formatDurationMinutes } from '@/lib/duration';

function normalizeAnswer(value: string | null): EventScheduleAnswer | null {
  if (value === 'yes' || value === 'no') return value;
  return null;
}

function answerAbbrev(a: EventScheduleAnswer | null): string {
  if (a === 'yes') return 'Y';
  if (a === 'no') return 'N';
  return '—';
}

function cellClass(a: EventScheduleAnswer | null): string {
  if (a === 'yes') return 'bg-emerald-500/90 text-white';
  if (a === 'no') return 'bg-rose-400/90 text-white';
  return 'bg-slate-100 text-slate-400';
}

type EventScheduleResultsPanelProps = {
  detail: EventScheduleDetail;
  currentUserId: string | undefined;
  formatSlotLabel: (slot: EventScheduleDetail['slots'][0]) => string;
  onSetAnswer?: (slotId: string, answer: EventScheduleAnswer) => void;
  savingAnswerSlotId?: string | null;
  onFinalizeSlot?: (slotId: string) => void;
  finalizingSlotId?: string | null;
};

export default function EventScheduleResultsPanel({
  detail,
  currentUserId,
  formatSlotLabel,
  onSetAnswer,
  savingAnswerSlotId = null,
  onFinalizeSlot,
  finalizingSlotId = null,
}: Readonly<EventScheduleResultsPanelProps>) {
  const duration = detail.durationMinutes ?? 180;
  const totalVoters = detail.voters.length;

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--paper)] p-4 shadow-[var(--shadow-soft)] space-y-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">Availability overview</h2>
        <p className="text-xs text-[var(--muted)]">
          Session length: {formatDurationMinutes(duration)} · {totalVoters}{' '}
          {totalVoters === 1 ? 'person' : 'people'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {detail.slots.map((slot) => {
          const total = slot.counts.yes + slot.counts.no;
          const yesPct = total ? (slot.counts.yes / total) * 100 : 0;
          const noPct = total ? (slot.counts.no / total) * 100 : 0;
          const myAnswer = normalizeAnswer(detail.myResponses[slot.id] ?? null);
          const savingResponse = savingAnswerSlotId === slot.id;
          const finalizing = finalizingSlotId === slot.id;
          return (
            <div
              key={slot.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--paper-strong)] p-3 text-left transition-shadow"
            >
              <p className="text-sm font-medium leading-snug">{formatSlotLabel(slot)}</p>
              <p className="text-xs text-[var(--muted)] mt-1">
                {slot.counts.yes} yes · {slot.counts.no} no
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 flex">
                <span
                  className="h-full bg-emerald-500"
                  style={{ width: `${yesPct}%` }}
                />
                <span
                  className="h-full bg-rose-400"
                  style={{ width: `${noPct}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {onSetAnswer && (
                  <>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Your response
                    </span>
                    <button
                      type="button"
                      disabled={savingAnswerSlotId !== null}
                      onClick={() => onSetAnswer(slot.id, 'yes')}
                      className={`wt-btn px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50 ${
                        myAnswer === 'yes' ? 'wt-btn-primary' : 'wt-btn-secondary'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      disabled={savingAnswerSlotId !== null}
                      onClick={() => onSetAnswer(slot.id, 'no')}
                      className={`wt-btn px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50 ${
                        myAnswer === 'no' ? 'wt-btn-primary' : 'wt-btn-secondary'
                      }`}
                    >
                      No
                    </button>
                  </>
                )}
                {onFinalizeSlot && (
                  <button
                    type="button"
                    disabled={finalizingSlotId !== null}
                    onClick={() => onFinalizeSlot(slot.id)}
                    className="ml-auto wt-btn wt-btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    {finalizing ? 'Setting…' : 'Use this time'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">
          Detail grid
        </h3>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--surface)]">
                <th className="sticky left-0 z-20 bg-[var(--surface)] text-left font-semibold p-2 border-b border-[var(--border)] min-w-[7rem] shadow-[4px_0_8px_-4px_rgba(0,0,0,.08)]">
                  Person
                </th>
                {detail.slots.map((slot) => (
                  <th
                    key={slot.id}
                    className="p-2 border-b border-[var(--border)] font-semibold text-center align-bottom min-w-[3.25rem] max-w-[5rem]"
                  >
                    <span className="block leading-tight line-clamp-3">
                      {formatSlotLabel(slot)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail.voters.map((v) => (
                <tr
                  key={v.userId}
                  className={
                    currentUserId === v.userId ? 'bg-[var(--primary-soft)]/50' : ''
                  }
                >
                  <td
                    className={[
                      'sticky left-0 z-10 font-medium p-2 border-b border-[var(--border)] shadow-[4px_0_8px_-4px_rgba(0,0,0,.06)]',
                      currentUserId === v.userId
                        ? 'bg-[var(--primary-soft)]'
                        : 'bg-[var(--paper)]',
                    ].join(' ')}
                  >
                    <span className="line-clamp-2">
                      {v.name}
                      {v.userId === detail.host.id ? (
                        <span className="text-[var(--muted)] font-normal"> · host</span>
                      ) : null}
                    </span>
                  </td>
                  {detail.slots.map((slot) => (
                    <td
                      key={slot.id}
                      className="p-1.5 border-b border-[var(--border)] text-center"
                    >
                      <span
                        className={[
                          'inline-flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-bold',
                          cellClass(normalizeAnswer(v.responsesBySlotId[slot.id])),
                        ].join(' ')}
                      >
                        {answerAbbrev(normalizeAnswer(v.responsesBySlotId[slot.id]))}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
          <span>
            <span className="inline-block h-2.5 w-2.5 rounded bg-emerald-500 mr-1 align-middle" />
            Yes
          </span>
          <span>
            <span className="inline-block h-2.5 w-2.5 rounded bg-rose-400 mr-1 align-middle" />
            No
          </span>
          <span>
            <span className="inline-block h-2.5 w-2.5 rounded bg-slate-200 mr-1 align-middle" />
            No answer
          </span>
        </div>
      </div>
    </section>
  );
}
