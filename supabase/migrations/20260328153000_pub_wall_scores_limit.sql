-- Add a bounded limit parameter so pub wall payloads stay predictable.
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
  where s.bar_name is not null
    and btrim(s.bar_name) <> ''
    and lower(btrim(s.bar_name)) = lower(btrim(p_bar_key))
  order by s.created_at desc
  limit least(greatest(coalesce(p_limit, 120), 1), 300);
$$;

-- Backward-compatible wrapper for callers still using one argument.
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
  'Pours for a pub wall tab; bar_name matches bar_key; country_code coalesced from pour then profile. SECURITY DEFINER for auth.users join. p_limit is clamped to 1..300.';
comment on function public.pub_wall_scores(text) is
  'Backward-compatible wrapper around pub_wall_scores(text, integer) with default limit 120.';

revoke all on function public.pub_wall_scores(text, integer) from public;
grant execute on function public.pub_wall_scores(text, integer) to anon, authenticated;
revoke all on function public.pub_wall_scores(text) from public;
grant execute on function public.pub_wall_scores(text) to anon, authenticated;
