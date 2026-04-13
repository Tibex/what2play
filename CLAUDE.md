# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Does

**What2Play** is a board game night planner. Users create events, invite friends, get AI-powered game recommendations from attendees' collections, vote via ranked Borda-count ballot, and track outcomes to improve future suggestions. Key differentiating flows: shelf photo OCR → collection import, multi-table seating optimizer for large events, and post-event feedback feeding recommendation weights.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 + React 19 + TypeScript + Tailwind CSS v4 |
| Backend | NestJS 11 + TypeORM 0.3 + PostgreSQL 16 |
| Auth | JWT (access + refresh) via passport-jwt; Google OAuth; Apple Sign-In |
| Real-time | Socket.io gateway (voting updates) |
| AI / Vision | Anthropic Claude SDK, Google Cloud Vision, Gemini — used in `backend/src/vision/` for shelf photo OCR |
| BGG | BoardGameGeek XML API — `backend/src/bgg/` |
| Notifications | Multi-channel: Web Push, SMTP (nodemailer), webhook |

## Commands

### Database
```bash
docker compose up -d                          # Start PostgreSQL on port 55432
cd backend && npm run db:migration:run         # Apply migrations
cd backend && npm run db:migration:generate    # Generate migration from entity diff
cd backend && npm run db:migration:revert      # Roll back last migration
```

> **Never** use TypeORM `synchronize: true` in production. All schema changes require migrations.

### Backend
```bash
cd backend && npm run start:dev    # Watch mode — http://localhost:3001
cd backend && npm run build        # Compile
cd backend && npm run lint         # ESLint --fix
cd backend && npm run test         # Jest unit tests
cd backend && npm run test:cov     # With coverage
cd backend && npm run test:e2e     # E2E suite
# Run a single test file:
cd backend && npx jest src/games/games.service.spec.ts
```

Swagger UI lives at `http://localhost:3001/api/docs`.

### Frontend
```bash
cd frontend && npm run dev     # Next.js dev server — http://localhost:3000
cd frontend && npm run build   # Production build
cd frontend && npm run lint    # ESLint
cd frontend && npm run test    # Vitest unit tests
# Run a single test file:
cd frontend && npx vitest run src/lib/feedback.test.ts
```

### BGG Import Script
```bash
cd backend && npm run bgg:import-top   # Import top BGG games into local DB
```

## Architecture

### Backend (`backend/src/`)

Standard NestJS module layout — each domain folder contains `*.module.ts`, `*.controller.ts`, `*.service.ts`, and a `dto/` subfolder.

| Module | Responsibility |
|--------|---------------|
| `auth/` | Register, login, refresh, Google/Apple OAuth, JWT guards |
| `users/` | Profile, avatar, preferences |
| `games/` | Collection CRUD, search, ratings, shelf-scan batch add |
| `bgg/` | BGG account link, XML sync, catalog import, verification challenge |
| `events/` | Event CRUD, RSVP, invite links, open events, multi-table optimizer |
| `recommendations/` | Candidate scoring engine (group ratings, history, time-fit, freshness) |
| `voting/` | Ranked ballot submit, Borda-count aggregation, Socket.io gateway |
| `feedback/` | Post-event survey; results feed recommendation weights |
| `friends/` | Friend requests, acceptance |
| `notifications/` | Web push, SMTP, webhook delivery; metrics |
| `calendar/` | Google Calendar sync for host events |
| `groups/` | Persistent friend groups with shared game pool |
| `vision/` | Shelf photo OCR — three providers: `GoogleVisionService`, `ClaudeVisionService`, `GeminiVisionService` |
| `entities/` | All TypeORM entities (shared across modules) |
| `database/` | `data-source.ts`, `typeorm.config.ts`, `migrations/` |

**Entity pattern**: entities live in `src/entities/` and are imported by the modules that need them. `index.ts` re-exports all.

**Key architectural constraint**: The voting WebSocket gateway (`voting/voting.gateway.ts`) is the only real-time channel; the rest of the app uses API polling.

### Frontend (`frontend/src/`)

| Folder | Content |
|--------|---------|
| `app/` | Next.js App Router pages; `(app)/` is the authenticated shell |
| `app/(app)/` | Dashboard, events, collection, friends, profile, admin |
| `app/` (root) | Public pages: landing, SEO landing pages, invite, auth, legal |
| `components/` | Shared UI — `events/`, `friends/`, `auth/`, `landing/`, `seo/`, etc. |
| `lib/api.ts` | Single `request<T>()` wrapper with auto-refresh; all API calls go here |
| `lib/store.ts` | Zustand auth store (tokens + user persisted to localStorage) |
| `lib/types.ts` | Shared TypeScript types |

**Data fetching**: React Query (`@tanstack/react-query`) for server state; Zustand for client/auth state. Do not duplicate server state into Zustand.

**API client**: `lib/api.ts` `request()` handles Bearer token injection, automatic 401 → refresh → retry, and error toast. Use it for all calls; don't fetch directly.

**Next.js version caveat**: This project runs Next.js 16 (not 15 or 13). Consult `node_modules/next/dist/docs/` before assuming API behavior — there are breaking changes from earlier versions.

### Environment Variables

Backend (`.env` or `.env.local` in `backend/`):
- `DATABASE_URL` or individual `DB_*` vars
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`
- `ANTHROPIC_API_KEY`, `GOOGLE_CLOUD_VISION_KEY_FILE`, `GEMINI_API_KEY`
- `SMTP_*` for email; `VAPID_*` for web push

Frontend (`.env.local` in `frontend/`):
- `NEXT_PUBLIC_API_URL` — backend base URL
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — Places autocomplete (optional)

### Key Patterns

- **Migrations over sync**: use `npm run db:migration:generate` + `npm run db:migration:run` for every schema change.
- **Guards**: `JwtAuthGuard` protects most backend routes; public endpoints are decorated with `@Public()`.
- **Validation**: `ValidationPipe` with `whitelist: true, transform: true` is global — use class-validator DTOs.
- **Shelf OCR**: `games.service.ts` orchestrates three vision providers with a semaphore-limited concurrency pool; BGG thumbnail fetching includes 429 retry logic.
- **Multi-table optimizer**: lives in `events/` service; generates seating plans maximizing seat coverage then vote-preference fit; runs are persisted as `EventMultiTableRun` entities.
