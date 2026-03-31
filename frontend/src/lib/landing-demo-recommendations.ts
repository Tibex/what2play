import type { Game } from '@/lib/types';
import { LANDING_DEMO_THUMBNAIL_BY_BGG_ID } from '@/lib/landing-demo-thumbnails';

export type DemoComplexity = 'light' | 'medium' | 'heavy';
export type DemoDuration = 'short' | 'medium' | 'long';

export type DemoRecommendationResult = {
  game: Game;
  explanation: Record<string, string>;
  score: number;
};

type DemoGameRow = {
  title: string;
  minPlayers: number;
  maxPlayers: number;
  playingTime?: number;
  yearPublished?: number;
  bggId?: number;
  bggRating?: number;
  weight?: number;
};

/** Static BGG-style metadata for landing demo cards (illustrative only). */
const META: Record<string, DemoGameRow> = {
  Hive: {
    title: 'Hive',
    minPlayers: 2,
    maxPlayers: 2,
    playingTime: 20,
    yearPublished: 2000,
    bggId: 2655,
    bggRating: 7.8,
    weight: 2.3,
  },
  Jaipur: {
    title: 'Jaipur',
    minPlayers: 2,
    maxPlayers: 2,
    playingTime: 30,
    yearPublished: 2009,
    bggId: 54043,
    bggRating: 7.5,
    weight: 2.3,
  },
  'Lost Cities': {
    title: 'Lost Cities',
    minPlayers: 2,
    maxPlayers: 2,
    playingTime: 20,
    yearPublished: 1999,
    bggId: 50,
    bggRating: 7.5,
    weight: 1.6,
  },
  Patchwork: {
    title: 'Patchwork',
    minPlayers: 2,
    maxPlayers: 2,
    playingTime: 30,
    yearPublished: 2014,
    bggId: 163412,
    bggRating: 7.6,
    weight: 1.6,
  },
  '7 Wonders: Duel': {
    title: '7 Wonders: Duel',
    minPlayers: 2,
    maxPlayers: 2,
    playingTime: 30,
    yearPublished: 2015,
    bggId: 173346,
    bggRating: 8.1,
    weight: 2.3,
  },
  'Schotten Totten': {
    title: 'Schotten Totten',
    minPlayers: 2,
    maxPlayers: 2,
    playingTime: 20,
    yearPublished: 1999,
    bggId: 372,
    bggRating: 7.5,
    weight: 1.8,
  },
  Watergate: {
    title: 'Watergate',
    minPlayers: 2,
    maxPlayers: 2,
    playingTime: 45,
    yearPublished: 2019,
    bggId: 274364,
    bggRating: 7.6,
    weight: 2.3,
  },
  'Undaunted: Normandy': {
    title: 'Undaunted: Normandy',
    minPlayers: 2,
    maxPlayers: 2,
    playingTime: 45,
    yearPublished: 2019,
    bggId: 268864,
    bggRating: 7.8,
    weight: 2.4,
  },
  'The Fox in the Forest': {
    title: 'The Fox in the Forest',
    minPlayers: 2,
    maxPlayers: 2,
    playingTime: 30,
    yearPublished: 2017,
    bggId: 221965,
    bggRating: 7.6,
    weight: 1.6,
  },
  Azul: {
    title: 'Azul',
    minPlayers: 2,
    maxPlayers: 4,
    playingTime: 45,
    yearPublished: 2017,
    bggId: 230802,
    bggRating: 7.8,
    weight: 1.8,
  },
  Splendor: {
    title: 'Splendor',
    minPlayers: 2,
    maxPlayers: 4,
    playingTime: 30,
    yearPublished: 2014,
    bggId: 148228,
    bggRating: 7.4,
    weight: 1.8,
  },
  'No Thanks!': {
    title: 'No Thanks!',
    minPlayers: 3,
    maxPlayers: 7,
    playingTime: 20,
    yearPublished: 2004,
    bggId: 12942,
    bggRating: 7.3,
    weight: 1.1,
  },
  'Ticket to Ride': {
    title: 'Ticket to Ride',
    minPlayers: 2,
    maxPlayers: 5,
    playingTime: 60,
    yearPublished: 2004,
    bggId: 9209,
    bggRating: 7.4,
    weight: 2.0,
  },
  Carcassonne: {
    title: 'Carcassonne',
    minPlayers: 2,
    maxPlayers: 5,
    playingTime: 45,
    yearPublished: 2000,
    bggId: 822,
    bggRating: 7.4,
    weight: 1.9,
  },
  'King of Tokyo': {
    title: 'King of Tokyo',
    minPlayers: 2,
    maxPlayers: 6,
    playingTime: 30,
    yearPublished: 2011,
    bggId: 70323,
    bggRating: 7.2,
    weight: 2.0,
  },
  Wingspan: {
    title: 'Wingspan',
    minPlayers: 1,
    maxPlayers: 5,
    playingTime: 70,
    yearPublished: 2019,
    bggId: 266192,
    bggRating: 8.0,
    weight: 2.5,
  },
  Viticulture: {
    title: 'Viticulture',
    minPlayers: 2,
    maxPlayers: 6,
    playingTime: 90,
    yearPublished: 2013,
    bggId: 183394,
    bggRating: 8.0,
    weight: 2.9,
  },
  Everdell: {
    title: 'Everdell',
    minPlayers: 1,
    maxPlayers: 4,
    playingTime: 80,
    yearPublished: 2018,
    bggId: 199792,
    bggRating: 8.0,
    weight: 2.8,
  },
  'Terraforming Mars': {
    title: 'Terraforming Mars',
    minPlayers: 1,
    maxPlayers: 5,
    playingTime: 120,
    yearPublished: 2016,
    bggId: 167791,
    bggRating: 8.4,
    weight: 3.3,
  },
  Scythe: {
    title: 'Scythe',
    minPlayers: 1,
    maxPlayers: 5,
    playingTime: 115,
    yearPublished: 2016,
    bggId: 169786,
    bggRating: 8.3,
    weight: 3.4,
  },
  'Brass: Birmingham': {
    title: 'Brass: Birmingham',
    minPlayers: 2,
    maxPlayers: 4,
    playingTime: 120,
    yearPublished: 2018,
    bggId: 224517,
    bggRating: 8.6,
    weight: 3.9,
  },
  'Gloomhaven: Jaws of the Lion': {
    title: 'Gloomhaven: Jaws of the Lion',
    minPlayers: 1,
    maxPlayers: 4,
    playingTime: 120,
    yearPublished: 2020,
    bggId: 291457,
    bggRating: 8.7,
    weight: 3.9,
  },
  'Food Chain Magnate': {
    title: 'Food Chain Magnate',
    minPlayers: 2,
    maxPlayers: 5,
    playingTime: 240,
    yearPublished: 2015,
    bggId: 175914,
    bggRating: 8.1,
    weight: 4.2,
  },
  'Twilight Imperium (if time allows)': {
    title: 'Twilight Imperium (if time allows)',
    minPlayers: 3,
    maxPlayers: 6,
    playingTime: 360,
    yearPublished: 1997,
    bggId: 12493,
    bggRating: 8.6,
    weight: 4.3,
  },
  '7 Wonders': {
    title: '7 Wonders',
    minPlayers: 3,
    maxPlayers: 7,
    playingTime: 30,
    yearPublished: 2010,
    bggId: 68448,
    bggRating: 7.7,
    weight: 2.3,
  },
  'Camel Up': {
    title: 'Camel Up',
    minPlayers: 2,
    maxPlayers: 8,
    playingTime: 30,
    yearPublished: 2014,
    bggId: 153938,
    bggRating: 7.0,
    weight: 1.5,
  },
  Codenames: {
    title: 'Codenames',
    minPlayers: 2,
    maxPlayers: 8,
    playingTime: 15,
    yearPublished: 2015,
    bggId: 178900,
    bggRating: 7.6,
    weight: 1.3,
  },
  'Power Grid': {
    title: 'Power Grid',
    minPlayers: 2,
    maxPlayers: 6,
    playingTime: 120,
    yearPublished: 2004,
    bggId: 2651,
    bggRating: 7.8,
    weight: 3.3,
  },
  'Blood Rage': {
    title: 'Blood Rage',
    minPlayers: 2,
    maxPlayers: 4,
    playingTime: 90,
    yearPublished: 2015,
    bggId: 170216,
    bggRating: 8.0,
    weight: 3.0,
  },
  'Two Rooms and a Boom': {
    title: 'Two Rooms and a Boom',
    minPlayers: 4,
    maxPlayers: 30,
    playingTime: 7,
    yearPublished: 2013,
    bggId: 134352,
    bggRating: 7.7,
    weight: 1.8,
  },
  'One Night Ultimate Werewolf': {
    title: 'One Night Ultimate Werewolf',
    minPlayers: 3,
    maxPlayers: 10,
    playingTime: 10,
    yearPublished: 2014,
    bggId: 147949,
    bggRating: 7.1,
    weight: 1.4,
  },
  Telestrations: {
    title: 'Telestrations',
    minPlayers: 4,
    maxPlayers: 8,
    playingTime: 30,
    yearPublished: 2009,
    bggId: 46213,
    bggRating: 7.7,
    weight: 1.1,
  },
  'Captain Sonar': {
    title: 'Captain Sonar',
    minPlayers: 2,
    maxPlayers: 8,
    playingTime: 45,
    yearPublished: 2017,
    bggId: 171131,
    bggRating: 7.8,
    weight: 2.1,
  },
  'Sidereal Confluence': {
    title: 'Sidereal Confluence',
    minPlayers: 4,
    maxPlayers: 9,
    playingTime: 180,
    yearPublished: 2017,
    bggId: 202426,
    bggRating: 8.0,
    weight: 3.7,
  },
  'Dune: Imperium (two tables)': {
    title: 'Dune: Imperium (two tables)',
    minPlayers: 1,
    maxPlayers: 4,
    playingTime: 120,
    yearPublished: 2020,
    bggId: 316554,
    bggRating: 8.4,
    weight: 3.5,
  },
};

const BUCKET_TITLES: Record<string, string[]> = {
  '2-light-short': ['Hive', 'Jaipur', 'Lost Cities'],
  '2-light-medium': ['Patchwork', '7 Wonders: Duel', 'Schotten Totten'],
  '2-medium-medium': ['Watergate', 'Undaunted: Normandy', 'The Fox in the Forest'],
  '3-4-light-short': ['Azul', 'Splendor', 'No Thanks!'],
  '3-4-light-medium': ['Ticket to Ride', 'Carcassonne', 'King of Tokyo'],
  '3-4-medium-medium': ['Wingspan', 'Viticulture', 'Everdell'],
  '3-4-medium-long': ['Terraforming Mars', 'Scythe', 'Brass: Birmingham'],
  '3-4-heavy-long': ['Gloomhaven: Jaws of the Lion', 'Food Chain Magnate', 'Twilight Imperium (if time allows)'],
  '5-6-light-medium': ['7 Wonders', 'Camel Up', 'Codenames'],
  '5-6-medium-medium': ['Power Grid', 'Terraforming Mars', 'Blood Rage'],
  '7-plus-light-medium': ['Two Rooms and a Boom', 'One Night Ultimate Werewolf', 'Telestrations'],
  '7-plus-medium-medium': ['Captain Sonar', 'Sidereal Confluence', 'Dune: Imperium (two tables)'],
};

function playerBucket(count: number): string {
  if (count <= 2) return '2';
  if (count <= 4) return '3-4';
  if (count <= 6) return '5-6';
  return '7-plus';
}

function preferredWeight(complexity: DemoComplexity): number {
  if (complexity === 'light') return 1.8;
  if (complexity === 'heavy') return 3.5;
  return 2.5;
}

function demoConfidence(explanation: Record<string, string>): 'high' | 'medium' | 'low' {
  const optionalSignals = ['rating', 'bgg', 'time', 'history', 'attendee_history', 'complexity', 'best_players'];
  const present = optionalSignals.filter((key) => explanation[key]).length;
  const coverage = present / optionalSignals.length;
  if (coverage >= 0.7) return 'high';
  if (coverage >= 0.4) return 'medium';
  return 'low';
}

function bestPlayersLine(row: DemoGameRow, playerCount: number): string {
  const { minPlayers, maxPlayers } = row;
  if (playerCount >= minPlayers && playerCount <= maxPlayers) {
    return `Best at ${playerCount}p per BGG community`;
  }
  if (playerCount < minPlayers) {
    return `Often best at ${minPlayers}+ (you picked ${playerCount}p)`;
  }
  return `Listed ${minPlayers}-${maxPlayers}p on BGG`;
}

function buildDemoExplanation(
  row: DemoGameRow,
  playerCount: number,
  complexity: DemoComplexity,
): Record<string, string> {
  const explanation: Record<string, string> = {};
  explanation.players = `Fits ${formatPlayerCountLabel(playerCount)} (${row.minPlayers}-${row.maxPlayers})`;
  if (row.playingTime) {
    explanation.time = `~${row.playingTime} min playtime`;
  }
  if (row.bggRating != null) {
    explanation.bgg = `BGG rating: ${row.bggRating.toFixed(1)}`;
  }
  if (row.weight != null) {
    const pref = preferredWeight(complexity);
    explanation.complexity = `Complexity fit: ${row.weight.toFixed(2)} vs group pref ${pref.toFixed(2)}`;
  }
  explanation.best_players = bestPlayersLine(row, playerCount);
  explanation.confidence = `Confidence: ${demoConfidence(explanation)}`;
  return explanation;
}

function formatPlayerCountLabel(playerCount: number): string {
  return `${playerCount} player${playerCount === 1 ? '' : 's'}`;
}

function slugId(title: string, index: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `landing-${base || 'game'}-${index}`;
}

function rowToGame(row: DemoGameRow, index: number): Game {
  const bggId = row.bggId;
  const thumbnailUrl =
    bggId != null ? LANDING_DEMO_THUMBNAIL_BY_BGG_ID[bggId] : undefined;
  return {
    id: slugId(row.title, index),
    title: row.title,
    minPlayers: row.minPlayers,
    maxPlayers: row.maxPlayers,
    playingTime: row.playingTime,
    yearPublished: row.yearPublished,
    bggId,
    thumbnailUrl,
  };
}

const HERO_PREVIEW_TITLES = ['Wingspan', 'Terraforming Mars', 'Azul'] as const;

/** Short labels in the same voice as in-app recommendation pills (hero teaser only). */
const HERO_PILL_POOL = [
  '4p fit',
  '70m',
  'BGG 8.0',
  'Weight fit',
  'Best 4p',
  'Group +',
  'Time +',
  'High conf',
  'Owned',
];

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return h >>> 0;
}

/** Three distinct pill strings per game, stable for SSR (seeded from game id). */
function pickHeroPreviewPills(seed: string): string[] {
  const out: string[] = [];
  const used = new Set<string>();
  let h = hashSeed(seed);
  let guard = 0;
  while (out.length < 3 && guard < 64) {
    const item = HERO_PILL_POOL[h % HERO_PILL_POOL.length];
    if (!used.has(item)) {
      used.add(item);
      out.push(item);
    }
    h = Math.imul(h, 1664525) + 1013904223;
    guard++;
  }
  while (out.length < 3) {
    out.push(HERO_PILL_POOL[out.length % HERO_PILL_POOL.length]);
  }
  return out.slice(0, 3);
}

export type HeroPreviewRow = { game: Game; score: number; pills: string[] };

/** Hero mock: compact single-row-height cards with decoy pills. */
export function getHeroRecommendationPreview(): HeroPreviewRow[] {
  return HERO_PREVIEW_TITLES.map((title, index) => {
    const row = META[title];
    if (!row) {
      throw new Error(`Missing landing demo META for hero: ${title}`);
    }
    const game = rowToGame(row, index);
    return {
      game,
      score: 92 - index * 4,
      pills: pickHeroPreviewPills(game.id),
    };
  });
}

/**
 * Returns up to three illustrative picks for the landing-page demo (not personalized).
 * Explanations mirror in-app recommendation pill style.
 */
export function getDemoRecommendations(
  playerCount: number,
  complexity: DemoComplexity,
  duration: DemoDuration,
): DemoRecommendationResult[] {
  const pb = playerBucket(playerCount);
  const tryKeys = [
    `${pb}-${complexity}-${duration}`,
    `${pb}-medium-${duration}`,
    `${pb}-${complexity}-medium`,
    `${pb}-medium-medium`,
    `3-4-${complexity}-${duration}`,
    '3-4-medium-medium',
  ];

  let titles: string[] | undefined;
  for (const k of tryKeys) {
    const t = BUCKET_TITLES[k];
    if (t?.length) {
      titles = t;
      break;
    }
  }
  if (!titles) {
    titles = BUCKET_TITLES['3-4-medium-medium']!;
  }

  return titles.slice(0, 3).map((title, index) => {
    const row = META[title];
    if (!row) {
      throw new Error(`Missing landing demo META for: ${title}`);
    }
    const explanation = buildDemoExplanation(row, playerCount, complexity);
    const score = 90 - index * 5;
    return {
      game: rowToGame(row, index),
      explanation,
      score,
    };
  });
}
