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

---

## Shelf Photo OCR Pipeline

Endpoint: `POST /games/collection/parse-shelf-async` — accepts a multipart photo, enqueues a background job, and returns `{ jobId }`. Progress is streamed to the client via Socket.io (`/shelf-parse` namespace, event `shelfParseProgress`); completion fires `shelfParseComplete`.

### Detection pipeline (all steps in `games.service.ts → parseShelfPhoto`)

| Stage | What happens |
|-------|-------------|
| `prepare` | Resize/compress image; build known-collection hint list |
| `detect` | Run 3–4 vision sources in parallel (semaphore-capped): Gemini upright, Gemini 90°-rotated spine pass, Claude, Google Cloud Vision OCR |
| `merge` | Deduplicate results across sources by fuzzy title match (`isLikelySameTitle`); apply junk filter (`isJunkShelfTitle`), overlap suppression (NMS via `suppressOverlappingShelfTitles`), and geometric outlier filter (`filterGeometricOutliers`) |
| `match` | Look up each merged title against local DB then BGG; emit per-item progress |
| `annotate` | Draw bounding boxes on the original image and return as base64 |
| `finalize` | Emit `shelfParseComplete` with candidates + annotated image |

### Vision providers (`backend/src/vision/`)

| Service | Model | Role |
|---------|-------|------|
| `GeminiVisionService` | `gemini-2.5-flash` | Two passes: upright (front-facing boxes) and 90°-rotated (spine-out stacked games). Primary source — best bounding boxes. |
| `ClaudeVisionService` | `claude-sonnet-4-6` | Single pass; fills in games Gemini missed. Uses tool-use API to return structured JSON. |
| `GoogleVisionService` | Cloud Vision OCR | Text-only fallback; no bounding-box confidence. Used when AI sources return nothing. |

### Key thresholds & filters

- `detectionConfidence < 0.50` — detections below this are discarded at parse time (both Gemini and Claude)
- `filterGeometricOutliers`: rejects boxes covering >20% of image area or with aspect ratio >5 (wall strips, floor bands)
- `suppressOverlappingShelfTitles`: NMS with IoU thresholds 0.20 / 0.28 — keeps highest-scoring box when two overlap
- `isJunkShelfTitle`: regex-based filter for generic non-game strings ("shelf", "wall", "box", etc.)

### Progress payload (`ShelfParseProgressDetail`)

Fields emitted during `detect` stage: `geminiUpright`, `geminiSpine`, `claude`, `ocrBlocks` — these are **raw per-source counts before deduplication** (same game counted multiple times). `mergedTitles` (emitted at `merge`) is the accurate unique count. Do not treat the raw sum as the final game count.

### Frontend components

| Component | File | Role |
|-----------|------|------|
| `ShelfPhotoUpload` | `components/ShelfPhotoUpload.tsx` | Drag-and-drop / file picker |
| `ShelfDetectionOverlay` | `components/ShelfDetectionOverlay.tsx` | Annotated image with bounding boxes |
| `ShelfParseReview` | `components/ShelfParseReview.tsx` | Candidate list with ownership badge + adaptive confidence pill; confirm/export |
| Page | `app/(app)/collection/add/page.tsx` | WebSocket orchestration, progress overlay |

---

## Recommendation Engine

Entry point: `recommendations/recommendations.service.ts → getCandidates(eventId)`.

### Scoring pipeline

1. **Pool**: union of all confirmed attendees' owned games
2. **Base score** (per game, per attendee): weighted sum of —
   - BGG rating (normalized)
   - Personal rating (if the attendee has rated the game)
   - Recency penalty (games played recently score lower for freshness)
   - Time fit (game's `playingTime` vs event's `durationMinutes`)
   - Player count fit (game's min/max vs confirmed attendee count)
3. **Group score**: average of per-attendee scores, weighted by attendance confidence
4. **History weight**: games that were previously picked at events with similar attendees score higher; games that consistently lost votes score lower
5. **AI re-ranking** (optional): if `ANTHROPIC_API_KEY` is set, a Claude Haiku call re-ranks the top candidates using natural-language reasoning about group fit; result is blended back with the numeric score
6. **Output**: top N `EventGameCandidate` rows written to DB, each with a `score` and `explanation` map (key = scoring factor, value = human-readable reason string)

### Re-ranking (`recommendations/ai-reranking.service.ts`)

- Model: `claude-haiku-4-5-20251001`
- Enabled automatically when `ANTHROPIC_API_KEY` is present
- Input: top 20 candidates with their numeric scores + group context (player count, duration, attendee rating history)
- Output: re-ordered list; scores are rescaled so the AI order is preserved while staying in the original numeric range
- Disable: unset `ANTHROPIC_API_KEY` (falls back to pure numeric ranking)
