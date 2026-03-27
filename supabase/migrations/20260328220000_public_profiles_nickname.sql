-- Optional public nickname (case-insensitive unique). Used for leaderboard display via scores.username sync.

alter table public.public_profiles
  add column if not exists nickname citext;

create unique index if not exists public_profiles_nickname_lower_uq
  on public.public_profiles (lower(trim(nickname::text)))
  where nickname is not null and btrim(nickname::text) <> '';
