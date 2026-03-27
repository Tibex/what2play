export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  timezone?: string;
  preferredDuration?: number;
  preferredWeight?: number;
  subscriptionTier: string;
}

export interface Game {
  id: string;
  bggId?: number;
  title: string;
  description?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  minPlayers: number;
  maxPlayers: number;
  playingTime?: number;
  weight?: number;
  yearPublished?: number;
  bggRating?: number;
  categories?: string[];
  mechanics?: string[];
}

export interface BggSearchResult {
  bggId: number;
  title: string;
  yearPublished?: number;
  thumbnailUrl?: string;
  imageUrl?: string;
  minPlayers?: number;
  maxPlayers?: number;
  playingTime?: number;
}

export interface SyncAccount {
  id: string;
  userId: string;
  provider: string;
  externalUsername: string;
  lastSyncedAt?: string;
  status: string;
  verified: boolean;
}

export interface GameOwnership {
  id: string;
  userId: string;
  gameId: string;
  game: Game;
}

export interface GameRating {
  id: string;
  userId: string;
  gameId: string;
  game: Game;
  rating: number;
  notes?: string;
}

export interface GameEvent {
  id: string;
  hostId: string;
  host: User;
  title: string;
  description?: string;
  dateTime: string;
  eventTimezone: string;
  durationMinutes?: number;
  location?: string;
  capacity?: number;
  type: 'invite' | 'open';
  status: string;
  votingDeadline?: string;
  votingStartedAttendeeCount?: number;
  selectedGameId?: string;
  fallbackGameId?: string;
  discoveryMode: boolean;
  autoPromoteWaitlist?: boolean;
  lastAttendanceChangeAt?: string;
  attendanceChangeAfterDecision?: boolean;
  lateCancellationCount?: number;
  sessionStartedAt?: string;
  sessionEndedAt?: string;
  sessionTotalMinutes?: number;
  sessionTimingSource?: string;
  attendees: EventAttendee[];
  candidates: EventGameCandidate[];
  createdAt: string;
}

export interface EventAttendee {
  id: string;
  eventId: string;
  userId?: string;
  user?: User;
  rsvpStatus: string;
  isGuest: boolean;
  guestName?: string;
  cancellationReason?: string;
  waitlistPriority?: number;
  lastStatusChangeAt?: string;
}

export interface EventInvite {
  id: string;
  eventId: string;
  token: string;
}

export interface EventGameCandidate {
  id: string;
  eventId: string;
  gameId: string;
  game: Game;
  source: string;
  score: number;
  explanation: Record<string, string>;
}

export interface EventVote {
  id: string;
  eventId: string;
  userId: string;
  gameId: string;
  game: Game;
  rank: number;
}

export interface VoteResult {
  gameId: string;
  totalScore: number;
  firstPlaceCount: number;
  averageRank: number;
}

export interface VotingStatus {
  expectedVoters: number;
  submittedVoters: number;
  allVoted: boolean;
}

export interface EventFeedback {
  id: string;
  eventId: string;
  userId: string;
  user: User;
  gameId?: string;
  game?: Game;
  enjoymentRating: number;
  finishedGame: boolean;
  durationFeel?: string;
  notes?: string;
}

export interface EventFeedbackAnalyticsGame {
  game: Game;
  recommendedCount: number;
  voteCount: number;
  playedCount: number;
  avgEnjoyment: number | null;
  playedByVotersCount: number;
  playedByNonVotersCount: number;
}

export interface EventFeedbackAnalytics {
  selectedGameId?: string;
  recommendedGames: EventFeedbackAnalyticsGame[];
  votedGames: EventFeedbackAnalyticsGame[];
  playedGames: EventFeedbackAnalyticsGame[];
  winnerPlayedRate: number | null;
  totalFeedbackEntries: number;
  totalUniquePlayers: number;
}

export interface FeedbackStatus {
  canSubmit: boolean;
  alreadySubmitted: boolean;
  eventEnded: boolean;
}

export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  requester: User;
  addressee: User;
  status: string;
}
