-- Resolve /pubs/:segment to bar_key: exact key first, then unique URL slug (hyphens, & → and).
create or replace function public.match_bar_pub_path_segment(p_segment text)
returns text
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  seg text := nullif(trim(coalesce(p_segment, '')), '');
  k text;
  n int;
begin
  if seg is null then
    return null;
  end if;

  select b.bar_key into k
  from bar_pub_stats b
  where lower(trim(b.bar_key)) = lower(seg)
  limit 1;
  if found then
    return k;
  end if;

  select count(*)::int into n
  from bar_pub_stats b
  where trim(both '-' from regexp_replace(
    regexp_replace(lower(trim(b.bar_key)), '&', ' and ', 'g'),
    '[^a-z0-9]+',
    '-',
    'g'
  )) = lower(seg);

  if n = 0 then
    return null;
  end if;
  if n > 1 then
    return null;
  end if;

  select b.bar_key into k
  from bar_pub_stats b
  where trim(both '-' from regexp_replace(
    regexp_replace(lower(trim(b.bar_key)), '&', ' and ', 'g'),
    '[^a-z0-9]+',
    '-',
    'g'
  )) = lower(seg)
  limit 1;

  return k;
end;
$$;

comment on function public.match_bar_pub_path_segment(text) is
  'Maps a pub URL path segment (slug or legacy bar_key) to bar_pub_stats.bar_key; null if none or ambiguous slug.';

revoke all on function public.match_bar_pub_path_segment(text) from public;
grant execute on function public.match_bar_pub_path_segment(text) to anon, authenticated;
