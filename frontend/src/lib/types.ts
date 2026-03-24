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
  durationMinutes?: number;
  location?: string;
  capacity?: number;
  type: 'invite' | 'open';
  status: string;
  votingDeadline?: string;
  selectedGameId?: string;
  discoveryMode: boolean;
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
  voteCount: number;
  averageRank: number;
}

export interface EventFeedback {
  id: string;
  eventId: string;
  userId: string;
  user: User;
  gameId?: string;
  enjoymentRating: number;
  finishedGame: boolean;
  durationFeel?: string;
  notes?: string;
}

export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  requester: User;
  addressee: User;
  status: string;
}
