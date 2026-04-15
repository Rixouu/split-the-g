-- Social surfaces (leaderboard, feed, walls): show the user's profile home country
-- for the flag when set — same “identity” source as nickname (scores.username sync).
-- Pour/geo ISO on the score row remains stored for location; it is used only when
-- the profile has no country_code.

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
      nullif(btrim(pp.country_code), ''),
      nullif(btrim(s.country_code), '')
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
  'Weekly global leaderboard; country_code prefers public_profiles (home) then scores (pour geo).';

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
      nullif(btrim(pp.country_code), ''),
      nullif(btrim(s.country_code), '')
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
  'Weekly top pours from users whose profile country matches; flag column prefers profile then pour.';

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
      nullif(btrim(pp.country_code), ''),
      nullif(btrim(s.country_code), '')
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
  'Weekly top pours for given emails; flag prefers profile then pour geo.';

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
      nullif(btrim(pp.country_code), ''),
      nullif(btrim(s.country_code), '')
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
  'Recent scores for feed; country_code prefers profile then pour geo.';

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
      nullif(btrim(pp.country_code), ''),
      nullif(btrim(s.country_code), '')
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
  'Recent scores for wall/collage; country_code prefers profile then pour geo.';

create or replace function public.pub_wall_scores(
  p_bar_key text,
  p_limit integer default 120
)
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
      nullif(btrim(pp.country_code), ''),
      nullif(btrim(s.country_code), '')
    ) as country_code,
    s.pint_price
  from public.scores s
  left join auth.users u
    on s.email is not null
    and btrim(s.email::text) <> ''
    and lower(btrim(s.email::text)) = lower(btrim(u.email::text))
  left join public.public_profiles pp
    on pp.user_id = u.id
  where s.bar_name is not null
    and btrim(s.bar_name) <> ''
    and lower(btrim(s.bar_name)) = lower(btrim(p_bar_key))
  order by s.created_at desc
  limit least(greatest(coalesce(p_limit, 120), 1), 300);
$$;

create or replace function public.pub_wall_scores(p_bar_key text)
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
  select *
  from public.pub_wall_scores(p_bar_key, 120);
$$;

comment on function public.pub_wall_scores(text, integer) is
  'Pub wall rows; country_code prefers profile then pour geo. SECURITY DEFINER.';

comment on function public.pub_wall_scores(text) is
  'Wrapper: pub_wall_scores(bar_key, 120).';
