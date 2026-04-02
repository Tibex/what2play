# What2Play — V1 Product Spec

## Overview

A web-first, mobile-responsive app that helps groups plan board game nights, discover the best game for attendees, vote on options, and improve future recommendations from past sessions.

## User Roles

- **Host/Organizer**: creates events, manages invitations, locks game selection, reviews feedback
- **Attendee**: RSVPs, votes on games, provides post-event feedback

## Core User Flows

### 1. Registration & Profile Setup

1. Sign up via email/password or Google/Apple social login
2. Complete profile: display name, avatar, timezone, preferred play length/weight
3. (Optional) Link BoardGameGeek account by username
4. (Optional) Verify BGG account via proof token placed in BGG profile bio

### 2. Game Library Management

1. **Manual add**: search BGG catalog by title → add to personal collection
2. **BGG import**: link BGG username → bulk-import owned games + ratings
3. **Shelf scan** (V1.5): upload shelf photo → OCR + fuzzy match → confirm and add
4. **Rate & annotate**: rate games (1-10), add personal notes, mark favorites

### 3. Event Creation (60-Second Onboarding)

1. Tap "New Game Night"
2. Set title, date/time, duration budget, location (address or "online")
3. Set capacity and event type (invite-only or open)
4. Smart defaults pre-fill from last event or template
5. Share invite link (for account-based joins)

### 4. RSVP & Attendance

1. Invitee receives link → views event details
2. RSVP: Going / Not Going
3. Host sees live attendance dashboard

### 5. Game Recommendations

1. System builds candidate set from attendee-owned games
2. Optional: host enables discovery mode (include non-owned games)
3. Filter by player count, duration, complexity
4. Score by: group ratings, completion history, time-fit, freshness
5. Display top N with explainability chips ("fits 6 players", "90 min", "high group rating")
6. Non-owned games labeled with source and availability hints

### 6. Voting & Game Selection

1. Host triggers voting round with deadline
2. Attendees rank games from most to least preferred (drag-and-drop)
3. System aggregates via Borda count + tie-break rules
4. Results visible in real-time (WebSocket)
5. Voting auto-closes at deadline; winner announced
6. Host can override/lock final selection

### 7. Post-Event Feedback

1. After event ends, attendees receive feedback prompt
2. Quick survey: enjoyment (1-5 stars), did you finish?, felt too long/just right/too short
3. Data feeds into recommendation weights for future events

### 8. Friends & Groups

1. Add friends by username or invite link
2. Create persistent groups for recurring game nights
3. Group-level game pool = union of all members' libraries

## Data Entities

| Entity                   | Key Fields                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| User                     | id, email, name, avatar_url, timezone, preferred_duration, preferred_weight                               |
| Friendship               | user_id, friend_id, status                                                                                |
| Game                     | id, bgg_id, title, description, image_url, min_players, max_players, playing_time, weight, year_published |
| UserGameOwnership        | user_id, game_id                                                                                          |
| UserGameRating           | user_id, game_id, rating, notes                                                                           |
| Event                    | id, host_id, title, date_time, duration_minutes, location, capacity, type (invite/open), status           |
| EventAttendee            | event_id, user_id, rsvp_status                                                                            |
| EventInvite              | id, event_id, token, email, created_at                                                                    |
| EventGameCandidate       | event_id, game_id, source (owned/discovery), score, explanation                                           |
| EventVote                | event_id, user_id, game_id, rank                                                                          |
| EventSelectedGame        | event_id, game_id, selected_by, selected_at                                                               |
| EventFeedback            | event_id, user_id, enjoyment_rating, finished_game, duration_feel, notes                                  |
| SyncAccount              | user_id, provider (bgg), external_username, last_synced_at, status                                        |
| BggVerificationChallenge | user_id, token, status, expires_at, verified_at                                                           |

## Free vs Pro Feature Split

| Feature                  | Free            | Pro Individual | Pro Host  |
| ------------------------ | --------------- | -------------- | --------- |
| Create events            | 2 active groups | Unlimited      | Unlimited |
| Basic voting             | Yes             | Yes            | Yes       |
| Advanced recommendations | Limited         | Full           | Full      |
| Analytics/history        | Last 5 events   | Full           | Full      |
| Event templates          | No              | No             | Yes       |
| Auto-reminders           | Basic           | Basic          | Advanced  |
| Affiliate game links     | Yes             | Yes            | Yes       |

## Non-Functional Requirements

- Page load < 2s on 3G mobile
- Real-time voting updates < 500ms
- PWA: installable, offline RSVP draft support
- WCAG 2.1 AA accessibility
- GDPR-compliant data handling
