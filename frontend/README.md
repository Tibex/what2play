# What2Play Frontend

Next.js 16 + React 19 web client for What2Play.

## Local Development

```bash
cd frontend
npm install
npm run dev
```

App URL: `http://localhost:3000`

## Environment Variables

Create `frontend/.env.local` with the values you need.

Core:

- `NEXT_PUBLIC_API_URL` (optional, defaults to `/api`)
- `BACKEND_PROXY_ORIGIN` (optional, used by Next.js rewrite when `NEXT_PUBLIC_API_URL=/api`)

Common optional values:

- `NEXT_PUBLIC_SITE_URL` (canonical site URL for SEO metadata)
- `NEXT_PUBLIC_SUPPORT_EMAIL` (public support contact shown in the app)
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (Google Places autocomplete in event forms)
- `GOOGLE_SITE_VERIFICATION` (Google Search Console verification token)
- `NEXT_PUBLIC_APPLE_CLIENT_ID` (Apple sign-in client ID)
- `NEXT_PUBLIC_DEV_FRESH_SESSION=true` (dev-only PWA session reset helper)

## Scripts

```bash
npm run dev     # start dev server
npm run build   # production build
npm run start   # start production server
npm run lint    # run eslint
npm run test    # run vitest
```

## API Wiring

- `src/lib/api.ts` uses `NEXT_PUBLIC_API_URL`.
- If it is not set, requests go to `/api/*`.
- `next.config.ts` rewrites `/api/*` to `BACKEND_PROXY_ORIGIN` (default `http://127.0.0.1:3001`).

## Notes

- This app is mobile-responsive and installable as a PWA.
- Google Calendar connection is currently available; Apple Calendar sync is intentionally disabled until beta implementation is completed.
