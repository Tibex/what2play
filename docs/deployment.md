# Deployment (easiest setup)

This project is easiest to deploy as:

- Frontend (`frontend`): Vercel (Next.js-native)
- Backend (`backend`): Render Web Service (Node.js)
- Database: Render Postgres (or Supabase Postgres)

## 1) Frontend on Vercel

1. In Vercel, import this GitHub repository.
2. Set root directory to `frontend`.
3. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = your backend URL (for example `https://api.what2play.games`)
   - `NEXT_PUBLIC_SITE_URL` = your frontend canonical URL (for example `https://what2play.games`)
   - `NEXT_PUBLIC_SUPPORT_EMAIL` = public support inbox shown on the contact page (for example `support@what2play.games`)
4. Deploy.

## 2) Backend on Render

1. Create a new Web Service from this GitHub repository.
2. Set root directory to `backend`.
3. Build command: `npm ci --include=dev && npm run build`
4. Start command: `npm run start:prod`
5. Add required environment variables (based on your backend config), including:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `FRONTEND_URL` – your frontend URL (e.g. `https://what2play.games`)
   - `BGG_API_TOKEN` – BoardGameGeek API token (optional, for BGG import)
   - `GOOGLE_CLIENT_ID` – Google OAuth client ID (optional, for Google login)
   - `GOOGLE_CLIENT_SECRET` – Google OAuth client secret
   - `GOOGLE_CALLBACK_URL` – e.g. `https://api.what2play.games/api/auth/google/callback`
   - `SUPPORT_TICKET_TO` – destination inbox for public support tickets (for example `support@what2play.games`)
   - any other app-specific envs you use in `@nestjs/config`
6. Deploy.

Note: if `NODE_ENV=production` is set in Render, you should still keep `--include=dev` in the build command so Nest CLI is available during build.

## 3) Database

- Create a managed Postgres instance.
- Copy its connection string to backend `DATABASE_URL`.

## 4) GitHub Actions deploy hooks

This repository includes `.github/workflows/deploy.yml`, which triggers provider deploy hooks on push to `main`.

Add one or both GitHub repository secrets:

- `VERCEL_DEPLOY_HOOK_URL`
- `RENDER_DEPLOY_HOOK_URL`

How to get them:

- Vercel: Project Settings -> Deploy Hooks
- Render: Service Settings -> Deploy Hook

Once set, every push to `main` triggers deployments automatically.
