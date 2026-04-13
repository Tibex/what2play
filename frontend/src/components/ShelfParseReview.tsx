'use client';

import { useMemo, useState } from 'react';
import type { ShelfParseCandidate } from '@/lib/types';
import { shelfDetectionColor } from '@/lib/shelfDetectionColors';

type Props = {
  candidates: ShelfParseCandidate[];
  onConfirm: (selected: ShelfParseCandidate[]) => Promise<void>;
  onExportCsv: (selected: ShelfParseCandidate[]) => Promise<void>;
  onExportXml: (selected: ShelfParseCandidate[]) => Promise<void>;
};

function GameIcon() {
  return (
    <svg className="w-5 h-5 text-[#c0ccb0]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75.125V4.875C2.25 4.254 2.754 3.75 3.375 3.75h17.25c.621 0 1.125.504 1.125 1.125V19.5m-18.75 0h18.75" />
    </svg>
  );
}

export default function ShelfParseReview({
  candidates,
  onConfirm,
  onExportCsv,
  onExportXml,
}: Readonly<Props>) {
  const [removedNumbers, setRemovedNumbers] = useState<Set<number>>(new Set());
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const selected = useMemo(
    () => candidates.filter((c) => !removedNumbers.has(c.detectionNumber)),
    [candidates, removedNumbers],
  );

  const remove = (n: number) =>
    setRemovedNumbers((prev) => new Set([...prev, n]));

  const restore = (n: number) =>
    setRemovedNumbers((prev) => {
      const next = new Set(prev);
      next.delete(n);
      return next;
    });

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(selected);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="wt-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">
          Recognized games{' '}
          <span className="text-[var(--muted)] font-normal text-sm">
            ({selected.length} of {candidates.length})
          </span>
        </h3>
      </div>

      <div className="space-y-2 mb-5">
        {candidates.map((candidate) => {
          const isRemoved = removedNumbers.has(candidate.detectionNumber);
          const color = shelfDetectionColor(candidate.detectionNumber);
          const imgSrc = candidate.thumbnailUrl ?? candidate.imageUrl ?? null;
          const imgFailed = imgErrors.has(candidate.detectionNumber);
          const showImg = imgSrc !== null && !imgFailed;

          return (
            <div
              key={`${candidate.detectionNumber}-${candidate.rawText}`}
              className={[
                'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-opacity',
                isRemoved ? 'border-[#e5ecd9] opacity-40' : 'border-[#e5ecd9] bg-white',
              ].join(' ')}
              style={isRemoved ? {} : { borderLeftWidth: '3px', borderLeftColor: color }}
            >
              {/* Colored number badge */}
              <span
                className="flex-shrink-0 flex items-center justify-center rounded-full text-[11px] font-bold text-white leading-none shadow-sm"
                style={{ backgroundColor: color, minWidth: '22px', height: '22px', padding: '0 5px' }}
              >
                {candidate.detectionNumber}
              </span>

              {/* Thumbnail */}
              <div className="h-12 w-10 flex-shrink-0 overflow-hidden rounded-md border border-[#e5ecd9] bg-[#f6f8f2] flex items-center justify-center">
                {showImg ? (
                  <img
                    src={imgSrc}
                    alt={candidate.title ?? candidate.rawText}
                    className="h-full w-full object-cover"
                    onError={() =>
                      setImgErrors((prev) => new Set([...prev, candidate.detectionNumber]))
                    }
                  />
                ) : (
                  <GameIcon />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight truncate">
                  {candidate.title ?? candidate.rawText}
                </p>
                {candidate.title && candidate.title !== candidate.rawText && (
                  <p className="text-xs text-[var(--muted)] truncate">OCR: {candidate.rawText}</p>
                )}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {candidate.isOwned && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#2d6a4f]/10 px-2 py-0.5 text-[10px] font-semibold text-[#2d6a4f]">
                      Owned
                    </span>
                  )}
                  <span className={[
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    candidate.source === 'local'
                      ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                      : 'bg-amber-100 text-amber-700',
                  ].join(' ')}>
                    {candidate.source === 'local' ? 'In library' : 'BGG'}
                  </span>
                  {candidate.confidence != null && (
                    <span className="text-[10px] text-[var(--muted)]">
                      {Math.round(candidate.confidence * 100)}% conf
                    </span>
                  )}
                </div>
              </div>

              {/* Action */}
              <button
                className={[
                  'flex-shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                  isRemoved
                    ? 'bg-[#e5ecd9] text-[var(--primary)] hover:bg-[#d4e3c1]'
                    : 'text-[var(--muted)] hover:bg-[#f0f4eb] hover:text-red-600',
                ].join(' ')}
                onClick={() => (isRemoved ? restore(candidate.detectionNumber) : remove(candidate.detectionNumber))}
              >
                {isRemoved ? 'Restore' : 'Remove'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          className="wt-btn wt-btn-primary px-5 py-2 disabled:opacity-50"
          onClick={() => void handleConfirm()}
          disabled={!selected.length || submitting}
        >
          {submitting ? 'Adding\u2026' : `Add ${selected.length} game${selected.length === 1 ? '' : 's'}`}
        </button>
        <button className="wt-btn px-4 py-2 text-sm" onClick={() => void onExportCsv(selected)}>
          Export CSV
        </button>
        <button className="wt-btn px-4 py-2 text-sm" onClick={() => void onExportXml(selected)}>
          Export XML
        </button>
      </div>
    </div>
  );
}
