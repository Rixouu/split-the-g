# Split The G

**Split The G** is a social pouring game: rate your pint, share the result, climb leaderboards, and compete with friends. The app pairs a **React Router 7 + Vite** frontend with **Supabase** (Postgres, Auth, Storage) for accounts, scores, competitions, and real-time-style feeds.

---

## Credits

**Lead developer & product revamp:** [Jonathan Rycx](https://github.com/Rixouu) — architecture, UI/UX, Supabase schema, and feature delivery for the current generation of the app.

---

## Stack

| Layer | Choice |
|--------|--------|
| UI | React 19, Tailwind CSS |
| Routing & SSR | React Router (framework mode) |
| Build | Vite |
| Backend / data | Supabase (PostgreSQL, Row Level Security, Auth, Storage) |
| Maps / places | Google Places (where configured) |

---

## Prerequisites

- **Node.js** 20+ (see `.nvmrc` if present)
- A **Supabase** project with this repo’s migrations applied
- **Environment variables** (see below)

---

## Environment variables

Create a `.env` in the project root (never commit secrets). Typical keys:

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous (public) key |

Optional / feature-specific keys (e.g. Google Places) are documented or enforced where used in code.

---

## Local development

```bash
npm install
npm run dev
```

The dev server defaults to **http://localhost:5173** (Vite).

---

## Database & migrations

Schema changes live under `supabase/migrations/`. Apply them with the [Supabase CLI](https://supabase.com/docs/guides/cli) (`supabase db push` / linked project) or by running migration SQL in the Supabase SQL Editor (in timestamp order).

### Profile nickname & leaderboard name

- **`public_profiles.nickname`** — optional display handle; uniqueness is enforced case-insensitively (see `20260328220000_public_profiles_nickname.sql`).
- **`scores.username`** — what feeds and leaderboards show; after saving a profile, the app syncs this from **nickname or full name**.

If nicknames do not persist, confirm the nickname migration ran. If the profile saves but the **leaderboard name** does not update, your `scores.email` values may not match the signed-in email **exactly** (casing). Migration **`20260328230000_sync_scores_username_for_jwt.sql`** adds `sync_scores_username_for_jwt(text)`, which updates `scores.username` using a **case-insensitive** match to the JWT email.

**Manual repair SQL** (Supabase SQL Editor) if you only want to fix data once:

```sql
-- Example: set username from profile for one user (adjust emails)
update public.scores s
set username = coalesce(nullif(trim(p.nickname::text), ''), trim(p.display_name::text))
from public.public_profiles p
where p.user_id = '<user-uuid>'
  and s.email is not null
  and lower(trim(s.email::text)) = lower(trim('<their-login-email>'));
```

---

## Build & production

```bash
npm run build
npm run start
```

Deploy the **server + client** output per your host (e.g. Vercel, Fly.io, Node adapter). Ensure production env vars match your Supabase project.

---

## Repository

Upstream for this line of work: **https://github.com/Rixouu/split-the-g**

---

## License

See the repository’s `LICENSE` file if present; otherwise treat usage as defined by the project owner.
