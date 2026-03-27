# Split The G

Split The G is a modern social pint game built around one simple obsession: how perfectly you can land the foam line through the Guinness `G`.

Players can submit pours, save scores, claim their profile with Google, add friends, compare stats, and join live competitions. The current version of the app was substantially revamped by [Jonathan Rycx](https://github.com/Rixouu), who leads product direction, design refinement, and full-stack implementation across the platform.

## What The App Does

- Score pours and keep a personal history.
- Claim results to an authenticated profile.
- Pick a nickname for leaderboards and feeds.
- Save favorite pubs with Google Places suggestions.
- Add friends, send email invites, and compare progress.
- Create public or private competitions with invite flows.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19 |
| App framework | React Router 7 |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Backend | Supabase |
| Database | PostgreSQL with RLS |
| Auth | Supabase Auth + Google sign-in |
| Storage | Supabase Storage |
| Location search | Google Maps JavaScript API + Places API (New) |
| Email | Resend |

## Project Notes

- This repo runs as an SSR React Router app.
- The UI is built around a dark Guinness-inspired visual system.
- Profile, friends, leaderboard sync, and competition flows depend on Supabase migrations being applied in order.

## Documentation

Developer-oriented docs live in [`docs/`](docs/) (overview, architecture, features, database, integrations).

## Local Setup

### Requirements

- Node.js 20+
- npm
- A Supabase project
- A Google Maps browser key if you want Places autocomplete
- A Resend API key if you want friend invite emails

### Environment variables

Create `.env.local` with the values your environment needs.

Core variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GOOGLE_MAPS_API_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `APP_URL`

### Install and run

```bash
npm install
npm run dev
```

Default local URL:

```bash
http://localhost:5173
```

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Database And Migrations

Supabase SQL lives in `supabase/migrations`.

Apply migrations with the Supabase CLI or run them in the Supabase SQL editor in timestamp order.

Important profile-related migrations:

- `20260328120000_friends_profiles_competition_visibility.sql`
- `20260328120100_friend_requests_from_email.sql`
- `20260328220000_public_profiles_nickname.sql`
- `20260328230000_sync_scores_username_for_jwt.sql`

### Nickname and leaderboard sync

- `public.public_profiles.nickname` stores the optional public nickname.
- `public.scores.username` is what the app shows in leaderboards and other social surfaces.
- Saving the profile syncs the leaderboard display name from `nickname` or `display_name`.

If leaderboard names are wrong for existing rows, this one-off SQL will backfill them:

```sql
update public.scores s
set username = coalesce(
  nullif(trim(p.nickname::text), ''),
  trim(p.display_name::text)
)
from public.public_profiles p
where p.user_id = '<user-uuid>'
  and s.email is not null
  and lower(trim(s.email::text)) = lower(trim('<their-login-email>'));
```

## Email Invites

Friend invite emails are rendered server-side and sent through Resend.

Key files:

- `app/routes/friend-invite-email.tsx`
- `app/utils/emails/friend-invite.ts`

The email includes:

- branded HTML layout
- inviter name and email
- recipient sign-in email
- CTA back to the profile flow

## Deployment

Build for production with:

```bash
npm run build
npm run start
```

Make sure production environment variables match your deployed Supabase, Google Maps, and Resend configuration.

## Repository

Primary repository:

- [github.com/Rixouu/split-the-g](https://github.com/Rixouu/split-the-g)

## License

See `LICENSE` if present. If not, usage remains under the project owner’s terms.
