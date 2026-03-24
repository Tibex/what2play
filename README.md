# Board Game Night

A web-first, mobile-responsive app for organizing board game nights with friends. Plan events, discover the best game for your group, vote on options, and improve recommendations from past sessions.

## Features

- **Authentication** — email/password registration and login with JWT tokens
- **Game Collection** — manage your board game library, search, rate, and annotate games
- **BGG Integration** — link your BoardGameGeek account and sync your collection
- **Event Planning** — create invite-only or open game nights with date, location, and capacity
- **Invite Links** — share links so friends can join without an account upfront
- **Smart Recommendations** — auto-generate game suggestions based on attendee collections, ratings, play history, time budget, and group fit
- **Ranked Voting** — attendees rank games; Borda count aggregation with tie-breaks and host override
- **Real-time Updates** — WebSocket-powered live voting results
- **Post-Event Feedback** — enjoyment rating, completion tracking, and duration feel for improving future suggestions
- **Session Timer** — track setup and gameplay duration for time-fit predictions
- **Friends** — add friends, accept requests, build your gaming group

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 + TypeScript + Tailwind CSS |
| Backend | NestJS + TypeORM + PostgreSQL |
| Real-time | Socket.io (WebSockets) |
| Auth | JWT with refresh tokens (passport-jwt) |
| API Docs | Swagger (OpenAPI) at `/api/docs` |

## Planning Docs

- Product specification: `PRODUCT_SPEC.md`
- Execution plan: `docs/board_game_night_app_plan.md`

## Getting Started

### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL) or a local PostgreSQL instance
- npm

### 1. Start the database

```bash
docker compose up -d
```

### 2. Start the backend

```bash
cd backend
cp .env .env  # edit if needed
npm run start:dev
```

The API runs at `http://localhost:3001`. Swagger docs at `http://localhost:3001/api/docs`.

### 3. Start the frontend

```bash
cd frontend
npm run dev
```

The app runs at `http://localhost:3000`.

## Project Structure

```
board-game-night/
├── backend/
│   └── src/
│       ├── auth/           # Authentication (register, login, JWT, guards)
│       ├── users/          # User profiles
│       ├── games/          # Game library, search, collection, ratings
│       ├── bgg/            # BoardGameGeek linking and sync
│       ├── events/         # Event CRUD, RSVP, invites
│       ├── recommendations/ # Game recommendation engine
│       ├── voting/         # Ranked voting, Borda count, WebSocket gateway
│       ├── feedback/       # Post-event feedback and session timing
│       ├── friends/        # Friend requests and management
│       └── entities/       # TypeORM database entities
├── frontend/
│   └── src/
│       ├── app/            # Next.js pages (login, register, dashboard, events, collection, friends, profile)
│       ├── components/     # Shared UI components
│       └── lib/            # API client, auth store, types
├── docker-compose.yml
└── PRODUCT_SPEC.md
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh token |
| GET/PATCH | `/api/users/me` | Get/update profile |
| GET | `/api/games/search?q=` | Search games |
| GET/POST/DELETE | `/api/games/collection/:gameId` | Manage collection |
| POST | `/api/games/rate` | Rate a game |
| POST/GET/DELETE | `/api/bgg/link` | BGG account linking |
| POST | `/api/bgg/sync` | Sync BGG collection |
| POST/GET | `/api/events` | Create/list events |
| GET | `/api/events/open` | Browse open events |
| GET/PATCH/DELETE | `/api/events/:id` | Event CRUD |
| POST | `/api/events/:id/rsvp` | RSVP to event |
| POST | `/api/events/:id/invite-link` | Create invite link |
| POST | `/api/events/:id/recommendations/generate` | Generate recommendations |
| GET | `/api/events/:id/recommendations` | Get recommendations |
| POST | `/api/events/:id/voting` | Submit ranked votes |
| GET | `/api/events/:id/voting/results` | Get voting results |
| POST | `/api/events/:id/voting/select-winner` | Host selects game |
| POST | `/api/events/:id/feedback` | Submit feedback |
| POST | `/api/events/:id/feedback/timing` | Submit session timing |
| GET/POST | `/api/friends` | Friends list / send request |
| POST | `/api/friends/:id/accept` | Accept friend request |
