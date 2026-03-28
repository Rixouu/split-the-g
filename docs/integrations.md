# Integrations

## Supabase

- **Auth:** Google OAuth for sign-in; session used client-side via `@supabase/supabase-js`.
- **Database & storage:** Standard Supabase Postgres + Storage bucket for pour imagery (see migrations and bootstrap SQL in repo).

**Client env (Vite, exposed to browser):**

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Google Maps / Places

Used for:

- **Pour + profile:** Places autocomplete (loads the Maps JavaScript API).
- **Pub detail pages:** embedded map iframe via the **Maps Embed API** (`PubGoogleMapEmbed`).
- **Pub detail opening hours:** server-side **Place Details (legacy)** when a **Google Place ID** exists (from a pour that used Places autocomplete, or from the admin “Google Place ID” field on the pub). See `app/utils/googlePlaceDetails.ts`.
- **Admin “Import from Google Maps”** on the pub page resolves a Place ID by: (1) `ChIJ…` in pasted text, (2) following **short links** (`maps.app.goo.gl`, etc.) server-side and scanning the final URL, (3) **Text Search** near coordinates parsed from long Maps URLs, (4) **Find Place from Text** using the pub’s name + address when needed. Then it calls **Place Details** for hours, name, address, and listing URL. You still **Save** to persist. These calls use the **legacy** Places JSON API (`maps.googleapis.com/maps/api/place/...`).

**Env:**

- `VITE_GOOGLE_MAPS_API_KEY` — browser key (referrer-restricted); used for JS/Places in the client and, if no server key is set, for Place Details in SSR loaders.
- `GOOGLE_MAPS_SERVER_KEY` (optional, **not** `VITE_`) — **required for admin import and server Place Details** when your public key uses **HTTP referrer** restrictions. Server `fetch()` to Google does not send a browser `Referer`, so Google returns **`REQUEST_DENIED`** for that key. Use a **second** API key: same project, **API restrictions** can list Maps Embed + JS + **Places API** (classic) as needed, but **Application restrictions → None** (or IP, if you have stable egress) — **not** “Websites”. Add `GOOGLE_MAPS_SERVER_KEY` in Vercel **Environment Variables** for Production (and Preview if you test there). Loaded via `process.env` in Vite SSR (see `vite.config.ts` `loadEnv`).

### APIs to enable (Google Cloud → APIs & Services → Library)

On the **same Google Cloud project** as your key, enable **all** of these (billing alone does not turn them on):

| API | Used for |
|-----|----------|
| **Maps JavaScript API** | `PlacesAutocomplete`, script in `root.tsx` |
| **Places API (New)** | Optional: newer client features if you add them later |
| **Places API** (classic — *separate product from “Places API (New)”*) | Legacy JSON: **Find Place**, **Text Search**, **Place Details** (`maps.googleapis.com/maps/api/place/details/json`, `findplacefromtext/json`, `textsearch/json`). **Required** for admin import and server-fetched opening hours. |
| **Maps Embed API** | Pub page iframe (`https://www.google.com/maps/embed/v1/search?...`) |

**Common mistake:** restricting the key to **Places API (New)** only. That does **not** authorize the legacy `/maps/api/place/*.json` endpoints; you must also enable and allow **Places API** (the classic entry in the API library).

If the embed shows *“This API key is not authorized to use this service or API”*, the usual fix is: open **Maps Embed API** → **Enable**, then under **Credentials** → your key → **API restrictions** → ensure **Maps Embed API** is in the allowed list (or use “Don’t restrict key” briefly to confirm).

### Key restrictions (Credentials → API key)

- **Browser key (`VITE_GOOGLE_MAPS_API_KEY`):** **Application restrictions → HTTP referrers (web sites):** add every origin that loads the app, for example:
  - `http://localhost:5173/*`
  - `http://127.0.0.1:5173/*`
  - `https://your-production-domain.com/*`
- **Server key (`GOOGLE_MAPS_SERVER_KEY`):** do **not** use website referrer restriction. Prefer **None** for application restrictions (still use **API restrictions** to limit which APIs the secret can call).
- **API restrictions:** on each key, allow the APIs that key needs. Omitting **Maps Embed API** breaks the iframe; omitting classic **Places API** breaks import and server-fetched opening hours.

Script is loaded from `app/root.tsx` when `VITE_GOOGLE_MAPS_API_KEY` is set; pub embeds read the same key from `window.ENV` after load.

## Resend (friend invite email)

Server route: `app/routes/friend-invite-email.tsx`  
Template builder: `app/utils/emails/friend-invite.ts`

**Env (server, not `VITE_`):**

- `RESEND_API_KEY` — required to send
- `RESEND_FROM_EMAIL` — verified sender (e.g. `Split The G <hello@yourdomain.com>`)
- `APP_URL` or `PUBLIC_APP_URL` — optional absolute site URL for links and logo in email; falls back to request origin

**Operational notes:**

- Resend may reject sends if the domain is not verified or the recipient is not allowed in sandbox mode.
- Friend requests are still stored in Supabase even if email delivery fails; the profile UI surfaces partial success when appropriate.

## Roboflow / inference

Home/score flows may use Roboflow workflow env vars (see `app/routes/home.tsx` and project `.env` examples). Document values there if you extend vision pipelines.
