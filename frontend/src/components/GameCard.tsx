'use client';

import { Game } from '@/lib/types';

interface GameCardProps {
  game: Game;
  actions?: React.ReactNode;
  explanation?: Record<string, string>;
  showScore?: number;
  bggUrl?: string;
  /** Compact layout for tight spaces (e.g. landing hero mock). */
  size?: 'default' | 'compact';
  /** When `full`, render `explanation` chips. Ignored if `previewPills` is set. */
  explanationTreatment?: 'full' | 'none';
  /** Fixed thumbnail height row with tiny decoy pills (landing hero). */
  previewPills?: string[];
  onOpenExternal?: () => void;
}

export default function GameCard({
  game,
  actions,
  explanation,
  showScore,
  bggUrl,
  size = 'default',
  explanationTreatment = 'full',
  previewPills,
  onOpenExternal,
}: GameCardProps) {
  const compact = size === 'compact';
  const heroStrip = compact && previewPills && previewPills.length > 0;

  const imgClass = compact ? 'h-14 w-14 shrink-0 object-cover' : 'h-24 w-24 object-cover shrink-0';
  const bodyPad = compact && !heroStrip ? 'p-2.5' : 'p-4';
  const titleClass = compact
    ? 'truncate font-semibold text-[var(--foreground)] text-xs leading-tight'
    : 'truncate font-semibold text-[var(--foreground)]';
  const metaClass = compact ? 'wt-muted text-[0.65rem] leading-tight truncate' : 'wt-muted mt-0.5 text-sm';
  const scoreClass = compact
    ? 'wt-chip shrink-0 border-[var(--border-strong)] bg-[var(--primary-soft)] text-[var(--primary)] text-[0.6rem] px-1 py-0 font-semibold leading-none'
    : 'wt-chip shrink-0 border-[var(--border-strong)] bg-[var(--primary-soft)] text-[var(--primary)]';
  const heroScoreClass =
    'wt-chip inline-flex h-4 min-w-[2rem] shrink-0 self-center items-center justify-center border-[var(--border-strong)] bg-[var(--primary-soft)] px-1 py-0 text-[0.38rem] font-semibold leading-none text-[var(--primary)]';
  const showFullExplanation =
    !heroStrip &&
    explanationTreatment === 'full' &&
    explanation &&
    Object.keys(explanation).length > 0;
  const actionsMt = compact ? 'mt-2' : 'mt-3';
  const explanationChipClass = compact
    ? 'wt-chip px-1.5 py-0.5 text-[0.62rem] leading-none'
    : 'wt-chip px-1.5 py-0.5 text-[0.68rem] leading-none';

  if (heroStrip) {
    const pills = (previewPills ?? [])
      .map((label) => (typeof label === 'string' ? label.trim() : ''))
      .filter(Boolean)
      .slice(0, 3);
    while (pills.length < 3) pills.push('Fit');
    return (
      <div className="wt-card overflow-hidden transition-shadow hover:shadow-[var(--shadow-raised)] rounded-lg">
        <div className="flex min-h-14 items-stretch">
          {game.thumbnailUrl &&
            (bggUrl ? (
              <a
                href={bggUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 self-stretch"
                onClick={onOpenExternal}
              >
                <img src={game.thumbnailUrl} alt={game.title} className="h-full w-14 object-cover" />
              </a>
            ) : (
              <img src={game.thumbnailUrl} alt={game.title} className="h-full w-14 shrink-0 object-cover" />
            ))}
          <div className="flex min-h-14 min-w-0 flex-1 items-center gap-1 overflow-hidden px-2 py-0.5">
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-0 overflow-hidden">
              <div className="min-h-0 min-w-0">
                {bggUrl ? (
                  <a
                    href={bggUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`${titleClass} block truncate hover:underline`}
                    onClick={onOpenExternal}
                  >
                    {game.title}
                  </a>
                ) : (
                  <h3 className={titleClass}>{game.title}</h3>
                )}
              </div>
              <div className="mt-1 flex min-h-0 w-full min-w-0 flex-wrap items-start gap-1">
                {pills.map((label, i) => (
                  <span
                    key={`${label}-${i}`}
                    className="inline-flex h-3.5 items-center whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--surface)] px-1 text-[0.34rem] font-semibold leading-none text-[var(--foreground)]"
                    title={label}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            {showScore !== undefined && (
              <span className={heroScoreClass} style={{ fontSize: '0.46rem', padding: '0.3rem' }}>
                {showScore.toFixed(0)} pts
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`wt-card overflow-hidden transition-shadow hover:shadow-[var(--shadow-raised)] ${compact ? 'rounded-lg' : ''}`}
    >
      <div className="flex">
        {game.thumbnailUrl &&
          (bggUrl ? (
            <a href={bggUrl} target="_blank" rel="noreferrer" className="shrink-0" onClick={onOpenExternal}>
              <img src={game.thumbnailUrl} alt={game.title} className={imgClass} />
            </a>
          ) : (
            <img src={game.thumbnailUrl} alt={game.title} className={imgClass} />
          ))}
        <div className={`${bodyPad} min-w-0 flex-1`}>
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              {bggUrl ? (
                <a
                  href={bggUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`${titleClass} block hover:underline`}
                  onClick={onOpenExternal}
                >
                  {game.title}
                </a>
              ) : (
                <h3 className={titleClass}>{game.title}</h3>
              )}
              <p className={metaClass}>
                {game.minPlayers}-{game.maxPlayers} players
                {game.playingTime && ` · ${game.playingTime} min`}
                {game.yearPublished && (compact ? '' : ` · ${game.yearPublished}`)}
              </p>
            </div>
            {showScore !== undefined && (
              <span className={scoreClass}>{showScore.toFixed(0)} pts</span>
            )}
          </div>
          {showFullExplanation && (
            <div className={`flex flex-wrap gap-1 ${compact ? 'mt-1.5' : 'mt-2'}`}>
              {Object.entries(explanation)
                .filter(([key]) => key !== 'score_breakdown')
                .map(([key, val]) => (
                  <span key={key} className={explanationChipClass}>
                    {val}
                  </span>
                ))}
            </div>
          )}
          {actions && <div className={actionsMt}>{actions}</div>}
        </div>
      </div>
    </div>
  );
}
