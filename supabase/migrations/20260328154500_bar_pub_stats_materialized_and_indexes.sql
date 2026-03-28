-- Materialized aggregate for pub directory reads.
create materialized view if not exists public.bar_pub_stats_mv as
select
  lower(trim(bar_name)) as bar_key,
  max(bar_name) as display_name,
  max(bar_address) filter (
    where bar_address is not null and trim(bar_address) <> ''
  ) as sample_address,
  round(avg(pour_rating)::numeric, 2) as avg_pour_rating,
  count(*) filter (where pour_rating is not null)::bigint as rating_count,
  count(*)::bigint as submission_count,
  max(google_place_id) filter (
    where google_place_id is not null and trim(google_place_id) <> ''
  ) as google_place_id
from public.scores
where bar_name is not null and trim(bar_name) <> ''
group by lower(trim(bar_name))
with no data;

refresh materialized view public.bar_pub_stats_mv;

create unique index if not exists bar_pub_stats_mv_bar_key_idx
  on public.bar_pub_stats_mv (bar_key);
create index if not exists bar_pub_stats_mv_rating_count_idx
  on public.bar_pub_stats_mv (rating_count desc, submission_count desc);

grant select on public.bar_pub_stats_mv to anon, authenticated;

create or replace function public.refresh_bar_pub_stats_mv()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view public.bar_pub_stats_mv;
end;
$$;

comment on function public.refresh_bar_pub_stats_mv() is
  'Refreshes the materialized pub aggregate used for fast pubs list/detail reads.';

revoke all on function public.refresh_bar_pub_stats_mv() from public;
grant execute on function public.refresh_bar_pub_stats_mv() to authenticated;

-- Supporting indexes for profile/competition query patterns.
create index if not exists friend_requests_to_email_pending_idx
  on public.friend_requests (to_email, created_at desc)
  where status = 'pending';

create index if not exists friend_requests_from_user_pending_idx
  on public.friend_requests (from_user_id, created_at desc)
  where status = 'pending';

create index if not exists competition_invites_invited_email_idx
  on public.competition_invites (invited_email);

create index if not exists competition_participants_competition_id_idx
  on public.competition_participants (competition_id);
