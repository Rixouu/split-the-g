-- Feed / Wall: coalesce(scores.country_code, profile.country_code) for flags without extra client joins.

create or replace function public.feed_scores_recent(p_limit int)
returns table (
  id uuid,
  slug text,
  username text,
  pint_image_url text,
  created_at timestamptz,
  split_score numeric,
  bar_name text,
  bar_address text,
  city text,
  region text,
  country_code text,
  pint_price numeric
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
    s.pint_image_url,
    s.created_at,
    s.split_score,
    s.bar_name,
    s.bar_address,
    s.city,
    s.region,
    coalesce(
      nullif(btrim(s.country_code), ''),
      nullif(btrim(pp.country_code), '')
    ) as country_code,
    s.pint_price
  from public.scores s
  left join auth.users u
    on s.email is not null
    and btrim(s.email::text) <> ''
    and lower(btrim(s.email::text)) = lower(btrim(u.email::text))
  left join public.public_profiles pp
    on pp.user_id = u.id
  order by s.created_at desc
  limit greatest(1, least(coalesce(p_limit, 48), 200));
$$;

comment on function public.feed_scores_recent(int) is
  'Recent scores for feed grid; country_code prefers pour geo then profile.';

create or replace function public.wall_scores_recent(p_limit int)
returns table (
  id uuid,
  slug text,
  username text,
  split_image_url text,
  pint_image_url text,
  created_at timestamptz,
  city text,
  region text,
  country text,
  country_code text,
  split_score numeric,
  bar_name text,
  bar_address text
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
    s.split_image_url,
    s.pint_image_url,
    s.created_at,
    s.city,
    s.region,
    s.country,
    coalesce(
      nullif(btrim(s.country_code), ''),
      nullif(btrim(pp.country_code), '')
    ) as country_code,
    s.split_score,
    s.bar_name,
    s.bar_address
  from public.scores s
  left join auth.users u
    on s.email is not null
    and btrim(s.email::text) <> ''
    and lower(btrim(s.email::text)) = lower(btrim(u.email::text))
  left join public.public_profiles pp
    on pp.user_id = u.id
  order by s.created_at desc
  limit greatest(1, least(coalesce(p_limit, 120), 300));
$$;

comment on function public.wall_scores_recent(int) is
  'Recent scores for wall/collage; country_code prefers pour geo then profile.';

revoke all on function public.feed_scores_recent(int) from public;
revoke all on function public.wall_scores_recent(int) from public;
grant execute on function public.feed_scores_recent(int) to anon, authenticated;
grant execute on function public.wall_scores_recent(int) to anon, authenticated;
