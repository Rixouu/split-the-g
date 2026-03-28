-- Global weekly leaderboard: show country flag from pour geo when set, else profile home country.

create or replace function public.leaderboard_scores_global(
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
  order by s.split_score desc, s.created_at desc
  limit greatest(1, least(coalesce(p_limit, 15), 50));
$$;

comment on function public.leaderboard_scores_global(timestamptz, int) is
  'Weekly global leaderboard rows; country_code prefers scores.country_code (pour location), else public_profiles.country_code via email.';

revoke all on function public.leaderboard_scores_global(timestamptz, int) from public;
grant execute on function public.leaderboard_scores_global(timestamptz, int) to anon, authenticated;
