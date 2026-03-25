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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
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
                  className="font-semibold text-gray-900 truncate hover:underline"
                >
                  {game.title}
                </a>
              ) : (
                <h3 className="font-semibold text-gray-900 truncate">{game.title}</h3>
              )}
              <p className="text-sm text-gray-500 mt-0.5">
                {game.minPlayers}-{game.maxPlayers} players
                {game.playingTime && ` · ${game.playingTime} min`}
                {game.yearPublished && ` · ${game.yearPublished}`}
              </p>
            </div>
            {showScore !== undefined && (
              <span className="flex-shrink-0 bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full">
                {showScore.toFixed(0)} pts
              </span>
            )}
          </div>
          {explanation && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Object.entries(explanation).map(([key, val]) => (
                <span
                  key={key}
                  className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full"
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
