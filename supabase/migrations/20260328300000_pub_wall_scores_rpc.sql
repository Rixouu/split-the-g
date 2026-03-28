-- Pours for a pub page “wall” tab: match scores.bar_name to bar_key (lower(trim)) semantics.
create or replace function public.pub_wall_scores(p_bar_key text)
returns setof public.scores
language sql
stable
security invoker
set search_path = public
as $$
  select s.*
  from public.scores s
  where s.bar_name is not null
    and btrim(s.bar_name) <> ''
    and lower(btrim(s.bar_name)) = lower(btrim(p_bar_key))
  order by s.created_at desc
  limit 300;
$$;

grant execute on function public.pub_wall_scores(text) to anon, authenticated;

create index if not exists scores_bar_name_lower_idx
  on public.scores (lower(btrim(bar_name)))
  where bar_name is not null and btrim(bar_name) <> '';
