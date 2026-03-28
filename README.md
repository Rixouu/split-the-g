# Split The G

**Split The G** is a social web app for scoring how cleanly a pint’s foam line crosses the Guinness “G”: capture a pour, get a split score, share a card, and compare with friends, pubs, and live competitions.

The current product was substantially revamped by [Jonathan Rycx](https://github.com/Rixouu), who leads product direction, design, and full-stack implementation.

## What the app does

- **Pour & score** — Camera or upload on `/`; scoring uses **Roboflow** (workflow / Inference JS) with sensible env-based configuration.
- **Shareable results** — Each pour has a stable URL under `/pour/:pourRef` (public slug). Legacy `/score/:splitId` redirects to the pour URL.
- **Profile** — Google sign-in via Supabase; display name, optional **nickname** (unique, case-insensitive), country, favorites (Google Places), friends, progress, expenses, and score history (`/profile` and nested routes).
- **Social surfaces** — **Feed** (`/feed`), **Wall** collage (`/wall`; `/collage` redirects), **Pubs** directory and per-pub pages (`/pubs`, `/pubs/:barKey`) with maps/embeds where configured.
- **Leaderboards** — Global weekly (`/leaderboard`), by country (`/countryleaderboard`), and past 24h (`/past24hrleaderboard`), with profile/pour country flags where data exists.
- **Competitions** — Create public or private comps, win rules (highest / closest to target / most submissions), location + optional linked pub, email invites, join/leave, live leaderboard and **Who’s in** tabs, pretty URLs via **`path_segment`** (`/competitions/:segment` or UUID), and pouring in-window with `/?competition=…`.
- **Friends** — Requests, accepts, email invites via **Resend** (`POST /api/friend-invite`), and comparisons from profile.

## Stack

| Layer | Technology |
| --- | --- |
| UI | React 19 |
| Framework | **React Router 7** (SSR + file-based routes) |
| Build | Vite 5 |
| Styling | Tailwind CSS 3 (Guinness-inspired dark theme) |
| Data & auth | Supabase (PostgreSQL, **RLS**, Auth, Storage) |
| Maps & places | Google Maps JavaScript API, Places (browser key); optional server key for details |
| Scoring / ML | Roboflow (workflow URL, Inference JS, optional publishable key) |
| Email | Resend (friend invites; branded templates) |
| Other | `date-fns`, `react-day-picker`, `sharp` (image pipeline), `qrcode`, `inferencejs` |

The app ships as an **SSR** React Router application (not a static SPA). A **service worker** can be registered for offline/PWA-style behavior where enabled.

## Repository layout (high level)

| Path | Purpose |
| --- | --- |
| `app/routes/` | Route modules (pages, loaders, actions) |
| `app/routes.ts` | Route table (index, segments, API routes) |
| `app/components/` | Shared UI (navigation, competitions, wall, pub, branded pieces, …) |
| `app/utils/` | Supabase client, scoring, maps, emails, paths (`competitionPath`, `pubPath`, …) |
| `public/` | Static assets; **mobile dock icons** live under `public/icons/nav/` |
| `supabase/migrations/` | Ordered SQL migrations (run in timestamp order) |
| `docs/` | Deeper notes: architecture, features, database, integrations |

## Documentation

Developer-oriented detail lives in [`docs/`](docs/) — start with [`docs/overview.md`](docs/overview.md) and [`docs/features.md`](docs/features.md).

## Requirements

- **Node.js** 20+
- **npm**
- A **Supabase** project (URL + anon key; run migrations)
- Optional: **Google Maps** key (Places autocomplete, embeds)
- Optional: **Resend** (friend-invite emails)
- Optional: **Roboflow** credentials (pour scoring)

## Environment variables

Create **`.env.local`** in the project root. Vite loads it for dev/build; `vite.config.ts` also loads env into the Node process for **server** code (loaders, `POST` handlers).

### Required for a minimal app

| Variable | Used for |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key (client + SSR) |

### Common optional (client)

| Variable | Used for |
| --- | --- |
| `VITE_GOOGLE_MAPS_API_KEY` | Places autocomplete, map embeds |

### Common optional (server / secrets)

| Variable | Used for |
| --- | --- |
| `RESEND_API_KEY` | Sending invite emails |
| `RESEND_FROM_EMAIL` | From address (e.g. `Split The G <noreply@…>`) |
| `APP_URL` / `PUBLIC_APP_URL` / `VITE_PUBLIC_APP_URL` / `EMAIL_PUBLIC_SITE_URL` | Absolute links in emails (see `friend-invite-email.tsx`) |
| `GOOGLE_MAPS_SERVER_KEY` | Server-side place details when used |

### Roboflow (pour scoring)

Configured primarily in **`app/routes/home.tsx`** — e.g. `VITE_ROBOFLOW_WORKFLOW_INFER_URL`, `VITE_ROBOFLOW_PUBLISHABLE_KEY` / `VITE_ROBOFLOW_API_KEY`, workspace and workflow ids, optional `ROBOFLOW_PRIVATE_API_KEY` on the server. Set what matches your Roboflow deployment.

### Install and run

```bash
npm install
npm run dev
```

Default dev URL: **http://localhost:5173** (Vite `--host` allows LAN access).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server + React Router SSR |
| `npm run build` | Production server + client build |
| `npm run start` | Run production server from `./build/server` |
| `npm run lint` / `npm run typecheck` | `react-router typegen` + `tsc` |

## Database and migrations

SQL lives in **`supabase/migrations/`**. Apply with the **Supabase CLI** or run files in **timestamp order** in the SQL editor.

Schema covers scores (slugs, geo, competitions), `public_profiles` (nickname, country), friends, competition participants/scores/invites, pub/bar keys, RLS policies, and RPCs for feed, wall, pub tabs, and leaderboards. See [`docs/database.md`](docs/database.md) for narrative detail.

**Nickname vs display:** optional `public_profiles.nickname` and `display_name` sync into `scores.username` for feeds and boards when the profile is saved.

## HTTP API routes (app)

| Path | Role |
| --- | --- |
| `POST /api/email` | Optional email capture tied to scoring flows (`email.tsx`) |
| `POST /api/friend-invite` | Resend-powered friend invite (`friend-invite-email.tsx`) |

## Mobile navigation icons

Custom dock assets are **`public/icons/nav/*.svg`** (feed, compete, pubs, profile, pour, wall, rank, faq). They are rendered in **`app/components/AppNavigation.tsx`** via CSS mask + `currentColor` so active/inactive colors stay consistent.

## Deployment

```bash
npm run build
npm run start
```

Set production env vars to match Supabase, maps, Resend, and Roboflow. If you deploy to **Vercel** (or similar), ensure serverless/Node adapters match React Router’s SSR output and that secrets are configured on the host, not only `VITE_*` in the client.

## Repository

- [github.com/Rixouu/split-the-g](https://github.com/Rixouu/split-the-g)

## License

See `LICENSE` if present; otherwise usage follows the project owner’s terms.
