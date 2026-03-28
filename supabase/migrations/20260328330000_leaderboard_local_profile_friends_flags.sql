-- Local: top pours from users whose Profile country matches (not pour geo).
-- Friends: same slim row shape as global + coalesce(country) for flags.

drop function if exists public.leaderboard_scores_for_country(text, timestamptz, int);
drop function if exists public.leaderboard_scores_for_emails(text[], timestamptz, int);

create or replace function public.leaderboard_scores_for_country(
  p_country text,
  p_since timestamptz,
  p_limit int
)
returns table (
  id uuid,
  slug text,
  username text,
  split_score numeric,
  created_at timestamptz,
  split_image_url text,
  country_code text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.slug,
    s.username,
    s.split_score,
    s.created_at,
    s.split_image_url,
    coalesce(
      nullif(btrim(s.country_code), ''),
      nullif(btrim(pp.country_code), '')
    ) as country_code
  from public.scores s
  inner join auth.users u
    on s.email is not null
    and btrim(s.email::text) <> ''
    and lower(btrim(s.email::text)) = lower(btrim(u.email::text))
  inner join public.public_profiles pp
    on pp.user_id = u.id
    and nullif(btrim(pp.country_code), '') is not null
    and upper(btrim(pp.country_code)) = upper(btrim(p_country))
  where s.created_at >= p_since
  order by s.split_score desc, s.created_at desc
  limit greatest(1, least(coalesce(p_limit, 15), 50));
$$;

comment on function public.leaderboard_scores_for_country(text, timestamptz, int) is
  'Weekly top pours from users whose public_profiles.country_code matches p_country; country_code column is pour-or-profile for UI flags.';

create or replace function public.leaderboard_scores_for_emails(
  p_emails text[],
  p_since timestamptz,
  p_limit int
)
returns table (
  id uuid,
  slug text,
  username text,
  split_score numeric,
  created_at timestamptz,
  split_image_url text,
  country_code text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.slug,
    s.username,
    s.split_score,
    s.created_at,
    s.split_image_url,
    coalesce(
      nullif(btrim(s.country_code), ''),
      nullif(btrim(pp.country_code), '')
    ) as country_code
  from public.scores s
  left join auth.users u
    on s.email is not null
    and btrim(s.email::text) <> ''
    and lower(btrim(s.email::text)) = lower(btrim(u.email::text))
  left join public.public_profiles pp
    on pp.user_id = u.id
  where s.created_at >= p_since
    and s.email is not null
    and exists (
      select 1
      from unnest(p_emails) as e(addr)
      where lower(btrim(s.email::text)) = lower(btrim(addr::text))
    )
  order by s.split_score desc, s.created_at desc
  limit greatest(1, least(coalesce(p_limit, 15), 50));
$$;

comment on function public.leaderboard_scores_for_emails(text[], timestamptz, int) is
  'Weekly top pours for given emails; country_code is coalesce(scores, profile) for leaderboard flags.';

grant execute on function public.leaderboard_scores_for_country(text, timestamptz, int)
  to anon, authenticated;
grant execute on function public.leaderboard_scores_for_emails(text[], timestamptz, int)
  to anon, authenticated;

comment on column public.public_profiles.country_code is
  'ISO 3166-1 alpha-2 (e.g. TH). Flag display; Local leaderboard lists pours from all users with this profile country.';
