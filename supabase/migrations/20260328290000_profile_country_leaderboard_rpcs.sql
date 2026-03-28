-- Profile: home country (ISO 3166-1 alpha-2) for display + local leaderboard filter.
alter table public.public_profiles
  add column if not exists country_code text;

comment on column public.public_profiles.country_code is
  'ISO 3166-1 alpha-2 (e.g. TH). Used for flag display and “local” leaderboard (pours tagged with this country on scores).';

create index if not exists public_profiles_country_code_idx
  on public.public_profiles (country_code)
  where country_code is not null and btrim(country_code) <> '';

-- Speed up local leaderboard (country + recency).
create index if not exists scores_country_created_split_idx
  on public.scores (country_code, created_at desc, split_score desc)
  where country_code is not null and btrim(country_code) <> '';

-- Top recent scores in a given country (pour location on score row).
create or replace function public.leaderboard_scores_for_country(
  p_country text,
  p_since timestamptz,
  p_limit int
)
returns setof public.scores
language sql
stable
security invoker
set search_path = public
as $$
  select s.*
  from public.scores s
  where s.created_at >= p_since
    and s.country_code is not null
    and upper(trim(s.country_code)) = upper(trim(p_country))
  order by s.split_score desc, s.created_at desc
  limit greatest(1, least(coalesce(p_limit, 15), 50));
$$;

-- Top recent scores for a set of emails (friends + you).
create or replace function public.leaderboard_scores_for_emails(
  p_emails text[],
  p_since timestamptz,
  p_limit int
)
returns setof public.scores
language sql
stable
security invoker
set search_path = public
as $$
  select s.*
  from public.scores s
  where s.created_at >= p_since
    and s.email is not null
    and exists (
      select 1
      from unnest(p_emails) as e(addr)
      where lower(trim(s.email)) = lower(trim(addr))
    )
  order by s.split_score desc, s.created_at desc
  limit greatest(1, least(coalesce(p_limit, 15), 50));
$$;

grant execute on function public.leaderboard_scores_for_country(text, timestamptz, int) to anon, authenticated;
grant execute on function public.leaderboard_scores_for_emails(text[], timestamptz, int) to anon, authenticated;
