# What2Play Backend

NestJS API for What2Play.

## What It Provides

- Auth (email/password + Google + Apple identity token login)
- User profile management
- Game search, collection, ratings
- BoardGameGeek linking, sync, and catalog import tooling
- Event lifecycle (create/edit/delete, invite links, RSVP)
- Recommendation generation and telemetry
- Ranked voting and result aggregation
- Post-event feedback and analytics
- Friends graph and event invitations
- Notification delivery (webhook, push webhook, SMTP)
- Calendar sync (Google supported, Apple currently disabled)
- Admin endpoints for moderation/catalog operations

## Local Development

```bash
cd backend
npm install
npm run db:migration:run
npm run start:dev
```

Swagger: `http://localhost:3001/api/docs`

## Commands

```bash
npm run start:dev
npm run build
npm run start:prod
npm run lint
npm run test
npm run test:e2e
```

## Database and Migrations

Use migrations for schema changes.

```bash
npm run db:migration:run
npm run db:migration:generate
npm run db:migration:revert
```

Runtime behavior:

- `DB_SYNCHRONIZE=true` enables TypeORM `synchronize` only in non-production environments.
- `DB_MIGRATIONS_RUN` defaults to `true`.

## Environment Variables

Core:

- `DATABASE_URL` (or `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`)
- `JWT_SECRET`
- `FRONTEND_URL`
- `APP_PORT` (default `3001`)

Auth and integrations:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL` (auth callback)
- `APPLE_CLIENT_ID`
- `BGG_API_TOKEN`

Calendar sync:

- `GOOGLE_CALENDAR_CALLBACK_URL` (calendar OAuth callback)
- `CALENDAR_TOKEN_ENCRYPTION_KEY` (required when storing calendar access/refresh tokens)
- `CALENDAR_APPLE_BETA_ENABLED` (defaults to disabled; Apple sync is not yet production-ready)

Notifications:

- `NOTIFICATIONS_WEBHOOK_URL`
- `NOTIFICATIONS_PUSH_WEBHOOK_URL`
- `WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

Support tickets:

- `SUPPORT_TICKET_TO`

## BGG Catalog Utilities

```bash
npm run bgg:import-top -- --status
npm run bgg:import-top -- --limit=500
npm run bgg:import-top -- --limit=500 --force
```

Production behavior:

- Weekly top-catalog import is scheduled for Mondays at 03:00 UTC.
- A 7-day cooldown and Postgres advisory lock prevent duplicate runs.
- Admin can force import via `POST /api/bgg/admin/import-top-catalog`.

## E2E Tests

Database e2e suites are guarded by `RUN_DB_E2E=true`.
CI enables this flag and runs the full e2e set against Postgres.
