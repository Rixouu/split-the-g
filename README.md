# 🥃 Split The G

**Split The G** is a social web app for scoring how cleanly a pint’s foam line crosses the Guinness “G”: capture a pour, get a split score, share a card, and compare with friends, pubs, and live competitions.

The current product was substantially revamped by [Jonathan Rycx](https://github.com/Rixouu), who leads product direction, design, and full-stack implementation.

[![React 19](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![React Router 7](https://img.shields.io/badge/React_Router-7-ef4444)](https://reactrouter.com/)
[![Vite](https://img.shields.io/badge/Vite-7-yellow)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-22c55e)](https://supabase.com/)
[![Roboflow](https://img.shields.io/badge/Roboflow-ML-ff6b00)](https://roboflow.com/)
![PWA Ready](https://img.shields.io/badge/PWA-Install%20Banner-9ca3af)

## ✨ Key Features

### 🥃 Pour & Score
- Capture a pour via camera or upload on `/`
- Score using **Roboflow** workflows / **Inference.js** (env-configured)
- Countdown + “in-window” pouring for competitions via `/?competition=...`

### 📣 Social Surfaces
- **Feed** (`/feed`) and **Wall collage** (`/wall`, `/collage` redirects)
- **Pubs** directory and pub pages (`/pubs`, `/pubs/:barKey`) with map/embed where configured
- Shareable, stable pour URLs under `/pour/:pourRef`

### 🏆 Profiles & Leaderboards
- Google sign-in via Supabase
- Profile pages with score history and progress
- Global weekly (`/leaderboard`), by country, and past 24h leaderboards

### 🧑‍🤝‍🧑 Competitions & Friends
- Create public/private competitions + win rules
- Email invites and join/leave flows
- Live leaderboard + **Who’s in** tabs
- Friends and comparisons from profile

### 🎯 Profile gamification
- **Progress** hub (`/profile/progress`): achievements, streak snapshots, and score insights (distribution, momentum, consistency) with a help panel — copy is fully localized
- **Achievements** (`/profile/achievements`): mobile-first **grid** of badges (no horizontal carousel), hero summary, **crown** tier pills, and **profile tier avatar** (gold progress ring + crown chip) on the mobile hub and desktop **Account** header
- **Sharing unlocked badges (mobile)**: branded **bottom sheet** above the dock with a **preview card** (`SplitTheGLogo`, sticker art, tier, title), **slide-up animation** (`app/app.css`), primary **Share to social apps** (`navigator.share`) and **Copy achievements link**; desktop/narrow desktop still uses one-shot Web Share + clipboard fallback (`profile-share-achievement.ts`)
- **Account (desktop)**: **Save profile** is full width from the `md` breakpoint up; **push notifications** sit in a bordered row with the toggle **beside** the copy; extra spacing before **Sign out**
- Server-side awards and streak updates driven by score events (see `supabase/migrations/*profile_gamification*`)

### 📬 Sponsorship & contact slots
- **`AdSlotBanner`** (`app/components/ad-slot-banner.tsx`): horizontal “ad slot” strip (dashed frame, subtle diagonal texture, **top** gold accent bar, megaphone, **Contact** mailto CTA) with per-surface i18n
- **Placements:** **Feed** (above *Latest pours*), **Wall**, **Competitions** (above listings), **Pubs** list (below filters), **Pub detail** (above Promos / Competitions / Wall). Pubs list copy pitches directory listings; pub detail copy pitches **banner advertising** (distinct email subjects per surface)

### 🖥️ Desktop footer
- Minimal **copyright strip** only (`AppDesktopFooter`, `md+`); no duplicate branding or nav links. Layout uses a flex column in `lang-layout` + `#root` so short pages still fill the viewport under the fixed header

### 🛡️ Pour trust & safety
- Server guards in `app/utils/pour-submission-guards.server.ts`: per-user **rate limits**, **duplicate image** detection (hash), optional **EXIF capture-time** freshness window (`POUR_RATE_LIMIT_MAX_PER_HOUR`, `POUR_EXIF_MAX_AGE_MINUTES`)
- Related migrations under `supabase/migrations/` for pour metadata / anti-cheat columns; **offline pour queue** on the client for flaky networks (see home pour flow)

## 🛠 Tech Stack

### Frontend
- **React 19**
- **React Router 7** (SSR + data APIs like loaders/actions)
- **Vite 7** build + bundling
- **Tailwind CSS 4** (dark Guinness-inspired theme via `@tailwindcss/postcss`)

### Data, Auth, and Storage
- **Supabase** (PostgreSQL + **RLS**, Auth, Storage)

### Scoring, Email, Maps
- **Roboflow** (workflow API + inference)
- **Resend** (friend-invite emails)
- **Google Maps JavaScript API** (Places + optional server key)

## 🚀 Quick Start

### Prerequisites
- **Node.js 20+**
- **npm**
- A **Supabase** project (URL + anon key + run migrations)
- Optional: Google Maps API key
- Optional: Resend API key (friend invites)
- Optional: Roboflow workspace/workflow keys (pour scoring)

### Installation
```bash
npm install
npm run dev
```

Default dev URL: **http://localhost:5173**

### Environment Variables
Create a **`.env.local`** in the project root. Vite loads client env; server code can read non-`VITE_` secrets too.

#### Required (minimal)
```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

#### Common optional
```env
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL="Split The G <noreply@your-domain>"
APP_URL=https://your-site.example
VITE_WEB_PUSH_PUBLIC_KEY=your-vapid-public-key
WEB_PUSH_PRIVATE_KEY=your-vapid-private-key
WEB_PUSH_SUBJECT=mailto:you@example.com
```

#### Pour submission guards (optional)
```env
POUR_RATE_LIMIT_MAX_PER_HOUR=5
POUR_EXIF_MAX_AGE_MINUTES=12
```
See `app/utils/pour-submission-guards.server.ts` for behavior.

#### Roboflow (pour scoring)
```env
VITE_ROBOFLOW_API_URL=https://detect.roboflow.com
VITE_ROBOFLOW_WORKSPACE=your-workspace
VITE_ROBOFLOW_WORKFLOW_ID=your-workflow-id
VITE_ROBOFLOW_WORKFLOW_INFER_URL= # optional full infer URL override
VITE_ROBOFLOW_WORKFLOW_VERSION_ID= # optional workflow version id

VITE_ROBOFLOW_PUBLISHABLE_KEY= # optional; falls back to VITE_ROBOFLOW_API_KEY
VITE_ROBOFLOW_API_KEY= # optional; legacy fallback for some setups
VITE_ROBOFLOW_INFERENCE_MODEL=split-g-label-experiment
VITE_ROBOFLOW_INFERENCE_VERSION=8

# Server-side secret (preferred)
ROBOFLOW_PRIVATE_API_KEY=your-private-api-key
```

## 📁 Project Structure
```txt
split-the-g/
├── app/
│   ├── routes/                # Pages, loaders, and actions (SSR)
│   ├── components/           # Shared UI (nav, competitions, wall, pub, ad-slot-banner, desktop footer, branded)
│   ├── utils/                # Supabase client, scoring, maps, emails, paths
│   └── ...                   # Route tables, i18n, etc.
├── public/                   # Static assets (including mobile dock icons)
├── supabase/migrations/      # Forward-only SQL migrations (RLS + schema)
└── docs/                     # Developer documentation
```

## 🔧 Available Scripts

### Development
```bash
npm run dev              # Vite dev server (host enabled)
```

### Build / Run
```bash
npm run build            # React Router production build
npm run start            # Run built SSR server
```

### Code Quality
```bash
npm run lint             # typecheck + eslint
npm run typecheck       # react-router typegen + tsc
```

## 🌟 Key Features Deep Dive

### 🧠 ML-Powered Scoring
- Camera/upload → server action → Roboflow workflow inference
- Extract detections and compute split score
- Store results and render shareable cards

### 🔒 Supabase RLS First
- All database access assumes Row Level Security policies
- Competitions, friends, profiles, and leaderboards are segmented through RLS

### 🗺️ Places + Pubs
- Pub pages use Places data where keys are configured
- Optional server-side Google key is supported for richer details

### 📱 PWA & Install UX
- Dedicated install banner component with logic for Chrome install prompt and iOS “Add to Home Screen”
- Stable, fixed layout with safe-area handling

## 📊 Performance & SEO
- React Router SSR for fast initial render
- Image pipeline via `sharp` (server processing where needed)
- SEO meta per route via `seoMetaForRoute`

## 🌐 Internationalization
- Multi-language UI using the app’s i18n context
- Localized routes/links + localized date/time rendering where applicable

## 📱 Mobile & Responsive Design
- Responsive layout across Feed/Wall/Pubs/Leaderboards
- Mobile dock icons are rendered with SVG masks and `currentColor` for consistent active states

## 🔐 Security & Compliance
- Supabase + **RLS** by default
- Secrets should live in `.env.local` and not be exposed via `VITE_` client env
- Roboflow uses `ROBOFLOW_PRIVATE_API_KEY` on the server (preferred)

## 🚀 Deployment
```bash
npm run build
npm run start
```

Deploy with any Node-capable SSR environment that can run the built server output.
Ensure your host has secrets configured (Supabase, Resend, Roboflow private key, etc.).

## 🔗 Integration Details

### Supabase Data Layer
- Schema and policies live under `supabase/migrations/`
- Feed, wall, and leaderboards use Supabase functions/RPC where applicable

### Email (Resend)
- Friend invites are sent via server-side routes that call Resend with branded templates

## 🤝 Contributing
Contributions are welcome. If you add features or routes:
1. Run `npm run lint`
2. Ensure migrations are forward-only (add new files rather than renaming history)
3. Open a PR and describe the change + any DB impacts

## 📄 License
No `LICENSE` file was found in this repository. If usage terms exist, they are expected to be defined by the project owner.

## 👥 Team
- **Jonathan** — Lead Developer — [Rixouu](https://github.com/Rixouu)

## 🙏 Acknowledgments
- React Router team for the SSR + data primitives
- Supabase for RLS-powered security
- Tailwind CSS for the UI foundation
- Roboflow for scoring workflows

---

**Built with ❤️ for clean pours and friendly competition.**
