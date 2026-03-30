'use client';

import { Game } from '@/lib/types';

interface GameCardProps {
  game: Game;
  actions?: React.ReactNode;
  explanation?: Record<string, string>;
  showScore?: number;
  bggUrl?: string;
}

export default function GameCard({
  game,
  actions,
  explanation,
  showScore,
  bggUrl,
}: GameCardProps) {
  return (
    <div className="wt-card overflow-hidden transition-shadow hover:shadow-[var(--shadow-raised)]">
      <div className="flex">
        {game.thumbnailUrl &&
          (bggUrl ? (
            <a href={bggUrl} target="_blank" rel="noreferrer" className="flex-shrink-0">
              <img
                src={game.thumbnailUrl}
                alt={game.title}
                className="w-24 h-24 object-cover"
              />
            </a>
          ) : (
            <img
              src={game.thumbnailUrl}
              alt={game.title}
              className="w-24 h-24 object-cover flex-shrink-0"
            />
          ))}
        <div className="p-4 flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {bggUrl ? (
                <a
                  href={bggUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate font-semibold text-[var(--foreground)] hover:underline"
                >
                  {game.title}
                </a>
              ) : (
                <h3 className="truncate font-semibold text-[var(--foreground)]">{game.title}</h3>
              )}
              <p className="wt-muted mt-0.5 text-sm">
                {game.minPlayers}-{game.maxPlayers} players
                {game.playingTime && ` · ${game.playingTime} min`}
                {game.yearPublished && ` · ${game.yearPublished}`}
              </p>
            </div>
            {showScore !== undefined && (
              <span className="wt-chip shrink-0 border-[var(--border-strong)] bg-[var(--primary-soft)] text-[var(--primary)]">
                {showScore.toFixed(0)} pts
              </span>
            )}
          </div>
          {explanation && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Object.entries(explanation)
                .filter(([key]) => key !== 'score_breakdown')
                .map(([key, val]) => (
                <span
                  key={key}
                  className="wt-chip"
                >
                  {val}
                </span>
                ))}
            </div>
          )}
          {actions && <div className="mt-3">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
