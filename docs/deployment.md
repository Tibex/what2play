# Deployment (pragmatic setup)

This project is easiest to deploy as:

- Frontend (`frontend`): Vercel (Next.js-native)
- Backend (`backend`): Render Web Service (Node.js)
- Database: Render Postgres (or Supabase Postgres)

## 1) Frontend on Vercel

1. In Vercel, import this GitHub repository.
2. Set root directory to `frontend`.
3. Configure environment variables:
   - Required:
     - `NEXT_PUBLIC_SITE_URL` = canonical frontend URL (for example `https://what2play.games`)
   - Recommended:
     - `NEXT_PUBLIC_SUPPORT_EMAIL` = public support inbox shown in the app
   - API routing (pick one mode):
     - Direct API mode:
       - `NEXT_PUBLIC_API_URL` = backend API base URL (for example `https://api.what2play.games/api`)
     - Proxy mode via frontend `/api` rewrite:
       - leave `NEXT_PUBLIC_API_URL` unset (or set it to `/api`)
       - set `BACKEND_PROXY_ORIGIN` = backend origin (for example `https://api.what2play.games`)
   - Optional:
     - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (Google Places autocomplete in event location)
     - `GOOGLE_SITE_VERIFICATION` (SEO verification meta)
     - `NEXT_PUBLIC_APPLE_CLIENT_ID` (only if enabling Apple sign-in UX)
4. Deploy.

## 2) Backend on Render

1. Create a new Web Service from this GitHub repository.
2. Set root directory to `backend`.
3. Build command: `npm ci --include=dev && npm run build`
4. Start command: `npm run start:prod`
5. Add environment variables:

Core:

- `DATABASE_URL` (or `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`)
- `JWT_SECRET`
- `FRONTEND_URL` (for CORS + OAuth redirect target)
- `NODE_ENV=production`

Google login:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL` (for example `https://api.what2play.games/api/auth/google/callback`)

Calendar sync:

- `GOOGLE_CALENDAR_CALLBACK_URL` (for example `https://api.what2play.games/api/calendar/google/callback`)
- `CALENDAR_TOKEN_ENCRYPTION_KEY` (base64 32-byte key used for encrypted token storage)
- `CALENDAR_APPLE_BETA_ENABLED=false` (Apple sync is currently disabled by default)

Other integrations:

- `BGG_API_TOKEN` (optional)
- `SUPPORT_TICKET_TO` (recommended for support routing)
- SMTP + webhook/push env vars if you want notification delivery enabled

6. Deploy.

Note: if `NODE_ENV=production` is set in Render, keep `--include=dev` in the build command so Nest CLI is available at build time.

## 3) Database

- Create a managed Postgres instance.
- Copy its connection string to backend `DATABASE_URL`.
- Run migrations with backend deploy/start flow (`npm run db:migration:run`) according to your release process.

## 4) GitHub Actions deploy hooks

This repository includes `.github/workflows/deploy.yml`, which triggers provider deploy hooks on push to `main`.

Add one or both GitHub repository secrets:

- `VERCEL_DEPLOY_HOOK_URL`
- `RENDER_DEPLOY_HOOK_URL`

How to get them:

- Vercel: Project Settings -> Deploy Hooks
- Render: Service Settings -> Deploy Hook

Once set, every push to `main` triggers deployments automatically.
