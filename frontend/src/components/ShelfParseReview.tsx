'use client';

import { useMemo, useState } from 'react';
import type { ShelfParseCandidate } from '@/lib/types';

type Props = {
  candidates: ShelfParseCandidate[];
  onConfirm: (selected: ShelfParseCandidate[]) => Promise<void>;
  onExportCsv: (selected: ShelfParseCandidate[]) => Promise<void>;
  onExportXml: (selected: ShelfParseCandidate[]) => Promise<void>;
};

export default function ShelfParseReview({
  candidates,
  onConfirm,
  onExportCsv,
  onExportXml,
}: Readonly<Props>) {
  const [removedNumbers, setRemovedNumbers] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const selected = useMemo(
    () => candidates.filter((candidate) => !removedNumbers.has(candidate.detectionNumber)),
    [candidates, removedNumbers],
  );

  const remove = (number: number) =>
    setRemovedNumbers((prev) => new Set([...prev, number]));

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
      <h3 className="font-semibold mb-3">Review recognized games</h3>
      <div className="space-y-2 mb-4">
        {selected.map((candidate) => (
          <div
            key={`${candidate.detectionNumber}-${candidate.rawText}`}
            className="flex items-center justify-between border border-[#e5ecd9] rounded-lg px-3 py-2"
          >
            <div className="text-sm">
              <span className="font-semibold mr-2">{candidate.detectionNumber}.</span>
              {candidate.title || candidate.rawText}
            </div>
            <button className="wt-btn px-2 py-1 text-xs" onClick={() => remove(candidate.detectionNumber)}>
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          className="wt-btn wt-btn-primary px-4 py-2 disabled:opacity-50"
          onClick={() => void handleConfirm()}
          disabled={!selected.length || submitting}
        >
          {submitting ? 'Adding...' : 'Confirm add'}
        </button>
        <button className="wt-btn px-4 py-2" onClick={() => void onExportCsv(selected)}>
          Export CSV
        </button>
        <button className="wt-btn px-4 py-2" onClick={() => void onExportXml(selected)}>
          Export XML
        </button>
      </div>
    </div>
  );
}
