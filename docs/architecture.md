# Architecture

## Runtime model

- **Framework:** React Router 7 in framework mode with **Vite**.
- **Rendering:** Server-side rendering for the document shell and route modules; interactive islands use `'use client'` only where needed (e.g. camera, maps, auth listeners).
- **Entry:** `app/root.tsx` defines the root `<html>` document, global links (fonts, favicons, manifest), `window.ENV` injection for the browser Supabase client, and optional Google Maps script loading.

## Repository layout (high level)

| Path | Role |
| ---- | ---- |
| `app/routes.ts` | Central route table; maps URLs to route modules |
| `app/routes/` | Page and API route modules (`loader` / `action` where used) |
| `app/components/` | Shared UI (navigation, page chrome, score widgets) |
| `app/utils/` | Supabase client, scoring helpers, email builders, etc. |
| `public/` | Static assets (logos, favicons, service worker, manifest) |
| `supabase/migrations/` | Ordered SQL for schema and RLS |

## Routing

Routes are declared in `app/routes.ts`. Notable patterns:

- **Resource routes** — e.g. `api/email` (score email preference), `api/friend-invite` (Resend-backed friend invite). These export `action` handlers and return `Response.json(...)`.
- **Dynamic segments** — `pour/:pourRef`, `competitions/:competitionId`.
- **Legacy / alternate paths** — e.g. `score/:splitId` redirects to the canonical pour URL.

## Data access

- **Browser:** `app/utils/supabase.ts` creates a Supabase client using `window.ENV` (populated from the root loader).
- **Server route modules:** Same module reads `import.meta.env` for `VITE_*` keys when executing on the server; secrets like `RESEND_API_KEY` use `process.env` in server-only code paths.

## Styling

- **Tailwind** with project tokens (Guinness-inspired palette).
- Global typography and scrollbar styling in `app/app.css`.
