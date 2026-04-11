'use client';

import type { ShelfParseCandidate } from '@/lib/types';

type Props = {
  imageUrl: string;
  candidates: ShelfParseCandidate[];
};

export default function ShelfDetectionOverlay({
  imageUrl,
  candidates,
}: Readonly<Props>) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-[#e5ecd9]">
      <img src={imageUrl} alt="Shelf preview" className="w-full h-auto block" />
      {candidates.map((candidate) => (
        <div
          key={`${candidate.detectionNumber}-${candidate.rawText}`}
          className="absolute border-2 border-[#2d6a4f] bg-[#2d6a4f]/10"
          style={{
            left: `${candidate.boundingBox.x * 100}%`,
            top: `${candidate.boundingBox.y * 100}%`,
            width: `${candidate.boundingBox.width * 100}%`,
            height: `${candidate.boundingBox.height * 100}%`,
          }}
        >
          <span className="absolute -top-6 left-0 rounded-full bg-[#2d6a4f] px-2 py-0.5 text-xs font-semibold text-white">
            {candidate.detectionNumber}
          </span>
        </div>
      ))}
    </div>
  );
}
