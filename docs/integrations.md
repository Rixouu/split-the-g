# Integrations

## Supabase

- **Auth:** Google OAuth for sign-in; session used client-side via `@supabase/supabase-js`.
- **Database & storage:** Standard Supabase Postgres + Storage bucket for pour imagery (see migrations and bootstrap SQL in repo).

**Client env (Vite, exposed to browser):**

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Google Maps / Places

Used for bar search autocomplete on pour and profile favorites.

- Script loaded from `app/root.tsx` when `VITE_GOOGLE_MAPS_API_KEY` is set.
- **APIs to enable on the browser key:** Maps JavaScript API + Places API (New).
- Restrict HTTP referrers (e.g. `http://localhost:5173/*`, production origin).

**Env:**

- `VITE_GOOGLE_MAPS_API_KEY`

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
