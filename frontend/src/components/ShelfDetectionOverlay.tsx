'use client';

import type { ShelfParseCandidate } from '@/lib/types';
import { shelfDetectionColor } from '@/lib/shelfDetectionColors';

type Props = {
  /** User's original photo (blob URL) — used when no server-rendered annotation exists */
  imageUrl: string;
  candidates: ShelfParseCandidate[];
  /** Server-drawn JPEG (data URL) with colored boxes — preferred when present */
  annotatedSrc?: string | null;
};

export default function ShelfDetectionOverlay({
  imageUrl,
  candidates,
  annotatedSrc,
}: Readonly<Props>) {
  if (annotatedSrc) {
    return (
      <div className="w-full overflow-hidden rounded-xl border border-[#e5ecd9]">
        <img
          src={annotatedSrc}
          alt="Shelf with detection outlines"
          className="w-full h-auto block"
        />
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-[#e5ecd9]">
      <img src={imageUrl} alt="Shelf preview" className="w-full h-auto block" />
      {candidates.map((candidate) => {
        const color = shelfDetectionColor(candidate.detectionNumber);
        return (
          <div
            key={`${candidate.detectionNumber}-${candidate.rawText}`}
            className="absolute border-2"
            style={{
              left: `${candidate.boundingBox.x * 100}%`,
              top: `${candidate.boundingBox.y * 100}%`,
              width: `${candidate.boundingBox.width * 100}%`,
              height: `${candidate.boundingBox.height * 100}%`,
              borderColor: color,
              backgroundColor: 'rgba(255,255,255,0.12)',
            }}
          >
            <span
              className="absolute -top-6 left-0 rounded-full px-2 py-0.5 text-xs font-semibold text-white shadow-sm"
              style={{ backgroundColor: color }}
            >
              {candidate.detectionNumber}
            </span>
          </div>
        );
      })}
    </div>
  );
}
