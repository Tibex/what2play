export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  socialProvider?: 'google' | 'apple' | string;
  timezone?: string;
  preferredDuration?: number;
  preferredWeight?: number;
  subscriptionTier: string;
  role: 'user' | 'admin';
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
  bggRating?: number;
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
  performance?: {
    pickedCount: number;
    avgVotingRank: number | null;
    votingPoolCount: number;
    autoRecommendedCount: number;
    avgEnjoyment: number | null;
  };
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
  groupId?: string | null;
  host: User;
  title: string;
  description?: string;
  dateTime: string | null;
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
  openReportCount?: number;
  lastReportedAt?: string | null;
  attendees: EventAttendee[];
  candidates: EventGameCandidate[];
  createdAt: string;
}

export interface PaginatedMeta {
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginatedMeta;
}

export interface EventAttendee {
  id: string;
  eventId: string;
  userId?: string;
  user?: User;
  rsvpStatus: string;
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

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  user?: User;
}

export interface Group {
  id: string;
  ownerId: string;
  name: string;
  description?: string | null;
  members: GroupMember[];
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationPoolAttendeeShare {
  userId: string;
  name: string;
  ownedPoolGames: number;
  weightedContribution: number;
  weightedSharePercent: number;
}

export interface RecommendationPoolStats {
  eventId: string;
  uniquePoolGames: number;
  attendeeShares: RecommendationPoolAttendeeShare[];
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

export interface FriendRequestByUserIdResponse {
  status: 'sent' | 'already_friends' | 'request_pending';
}

export interface InviteFriendsResponse {
  invitedUserIds: string[];
  alreadyAttendingUserIds: string[];
  notFriendsUserIds: string[];
}

export interface CalendarAccount {
  id: string;
  userId: string;
  provider: 'google' | 'apple' | string;
  status: string;
  scopes?: string[] | null;
  tokenExpiresAt?: string | null;
  lastSyncedAt?: string | null;
  lastError?: string | null;
}

export interface EventCalendarSyncItem {
  id: string;
  eventId: string;
  userId: string;
  provider: 'google' | 'apple' | string;
  syncState: string;
  remoteEventId?: string | null;
  lastError?: string | null;
  lastSyncedAt?: string | null;
}

export interface EventCalendarSyncState {
  eventId: string;
  canManage: boolean;
  items: EventCalendarSyncItem[];
}

export type EventScheduleAnswer = 'yes' | 'no';

export interface EventScheduleSlotSummary {
  id: string;
  start: string;
  label: string | null;
  sortOrder: number;
  counts: { yes: number; no: number };
}

export interface EventScheduleDetail {
  eventId: string;
  title: string;
  eventTimezone: string;
  durationMinutes: number | null;
  status: string;
  isHost: boolean;
  host: { id: string; name: string };
  slots: EventScheduleSlotSummary[];
  myResponses: Record<string, EventScheduleAnswer>;
  voters: {
    userId: string;
    name: string;
    responsesBySlotId: Record<string, EventScheduleAnswer | null>;
  }[];
}
