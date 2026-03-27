# Database (Supabase)

All schema changes should live in `supabase/migrations/` and be applied in **timestamp order** (CLI `db push` or SQL editor).

## Core tables (public)

| Table | Purpose |
| ----- | ------- |
| `scores` | Pour results: `username`, `split_score`, images, geo, `email`, `slug`, etc. |
| `public_profiles` | Per-user `display_name`, optional `nickname` (`citext`), `updated_at` |
| `friend_requests` | Pending/accepted/declined requests; `from_user_id`, `to_email`, `from_email` |
| `user_friends` | Symmetric friendship rows after accept |
| `user_favorite_bars` | Saved pubs for a user |
| `competitions` | Competition metadata, visibility, win rules, windows |
| `competition_participants` | Who joined |
| `competition_scores` | Links scores to competitions |
| `competition_invites` | Email invites to private/public comps |

## Row Level Security

RLS is enabled on these tables. Policies are defined in migrations (e.g. `20260328120000_friends_profiles_competition_visibility.sql` and follow-ups). When debugging “permission denied” or empty reads, verify:

- The JWT role (`anon` vs `authenticated`) matches the policy.
- Migrations for `friend_requests.from_email` and `public_profiles.nickname` are applied on the target project.

## Helpful functions

- **`sync_scores_username_for_jwt(text)`** — Updates `scores.username` for all rows whose `email` matches the current JWT email with case-insensitive comparison. Defined in `20260328230000_sync_scores_username_for_jwt.sql`.

## Manual repair (example)

Backfill leaderboard display from profile for one user (adjust IDs/emails):

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
