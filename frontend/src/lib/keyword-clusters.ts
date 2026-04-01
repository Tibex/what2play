export type KeywordCluster = {
  id: string;
  path: string;
  primaryKeyword: string;
  intent: 'transactional' | 'informational';
  pageTitle: string;
  metaDescription: string;
  summary: string;
};

export const KEYWORD_CLUSTERS: KeywordCluster[] = [
  {
    id: 'board-game-night-planner',
    path: '/board-game-night-planner',
    primaryKeyword: 'board game night planner',
    intent: 'transactional',
    pageTitle: 'Board Game Night Planner for Groups',
    metaDescription:
      'Plan board game nights with scheduling, constraints, recommendations, and final game selection in one workflow.',
    summary:
      'Coordinate your next session without juggling chat threads, spreadsheets, and separate voting tools.',
  },
  {
    id: 'board-game-voting-app',
    path: '/board-game-voting-app',
    primaryKeyword: 'board game voting app',
    intent: 'transactional',
    pageTitle: 'Board Game Voting App for Faster Decisions',
    metaDescription:
      'Use ranked voting for board game nights so your group can choose fairly and lock a game quickly.',
    summary:
      'Replace endless debates with a clear, transparent ranking process that helps groups commit.',
  },
  {
    id: 'board-game-recommendation-tool',
    path: '/board-game-recommendation-tool',
    primaryKeyword: 'board game recommendation tool',
    intent: 'transactional',
    pageTitle: 'Board Game Recommendation Tool for Real Group Constraints',
    metaDescription:
      'Find the best board game for tonight using player count, duration, and complexity constraints.',
    summary:
      'Filter by the group you have right now and surface games people can actually bring and play.',
  },
  {
    id: 'boardgamegeek-collection-sync',
    path: '/boardgamegeek-collection-sync',
    primaryKeyword: 'BoardGameGeek collection sync',
    intent: 'transactional',
    pageTitle: 'BoardGameGeek Collection Sync for Game Night Planning',
    metaDescription:
      'Connect your BoardGameGeek profile and use owned games in event recommendations, voting, and planning.',
    summary:
      'Import and maintain your library once, then use it across recommendations and event setup.',
  },
  {
    id: 'how-to-plan-a-board-game-night',
    path: '/how-to-plan-a-board-game-night',
    primaryKeyword: 'how to plan a board game night',
    intent: 'informational',
    pageTitle: 'How to Plan a Board Game Night (Practical Checklist)',
    metaDescription:
      'Step-by-step guide to planning a board game night with invitations, game selection, voting, and follow-up.',
    summary:
      'Use a repeatable planning checklist to reduce friction before, during, and after each session.',
  },
];

export const INDEXABLE_MARKETING_PATHS = [
  '/',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/resources',
  ...KEYWORD_CLUSTERS.map((cluster) => cluster.path),
];

export function getKeywordCluster(id: string): KeywordCluster {
  const cluster = KEYWORD_CLUSTERS.find((item) => item.id === id);
  if (!cluster) {
    throw new Error(`Missing keyword cluster: ${id}`);
  }
  return cluster;
}
