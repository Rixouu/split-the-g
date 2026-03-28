-- pub_wall_scores joins auth.users for profile country fallback; SECURITY INVOKER
-- runs as anon/authenticated → "permission denied for table users".
-- Align with feed_scores_recent / wall_scores_recent: SECURITY DEFINER + locked search_path.
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
  limit 300;
$$;

comment on function public.pub_wall_scores(text) is
  'Pours for a pub wall tab; bar_name matches bar_key; country_code coalesced from pour then profile. SECURITY DEFINER for auth.users join.';

revoke all on function public.pub_wall_scores(text) from public;
grant execute on function public.pub_wall_scores(text) to anon, authenticated;
