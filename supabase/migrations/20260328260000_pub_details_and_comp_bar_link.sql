-- Optional pub directory fields, extra aggregates for pub detail, link competitions to a pub.

-- ---------------------------------------------------------------------------
-- Competitions → pub (bar_pub_stats.bar_key)
-- ---------------------------------------------------------------------------
alter table public.competitions
  add column if not exists linked_bar_key text;

comment on column public.competitions.linked_bar_key is
  'Optional normalized bar key (matches scores / bar_pub_stats) when the comp is at a specific pub.';

create index if not exists competitions_linked_bar_key_idx
  on public.competitions (linked_bar_key)
  where linked_bar_key is not null;

-- ---------------------------------------------------------------------------
-- Community-maintained pub facts (hours, promos, etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.pub_place_details (
  bar_key text primary key,
  opening_hours text,
  guinness_info text,
  alcohol_promotions text,
  maps_place_url text,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.pub_place_details enable row level security;

drop policy if exists "pub_place_details_select_all" on public.pub_place_details;
create policy "pub_place_details_select_all"
  on public.pub_place_details for select
  using (true);

drop policy if exists "pub_place_details_insert_auth" on public.pub_place_details;
create policy "pub_place_details_insert_auth"
  on public.pub_place_details for insert to authenticated
  with check (true);

drop policy if exists "pub_place_details_update_auth" on public.pub_place_details;
create policy "pub_place_details_update_auth"
  on public.pub_place_details for update to authenticated
  using (true)
  with check (true);

grant select on public.pub_place_details to anon, authenticated;
grant insert, update on public.pub_place_details to authenticated;

-- ---------------------------------------------------------------------------
-- Distinct drinkers + pint spend (community + signed-in user) for a bar_key
-- ---------------------------------------------------------------------------
create or replace function public.pub_extra_stats_for_bar(p_bar_key text)
returns table (
  distinct_drinkers bigint,
  total_pint_spend numeric,
  my_pint_spend numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(
      distinct coalesce(
        nullif(lower(trim(s.email::text)), ''),
        s.session_id::text
      )
    )::bigint,
    coalesce(
      sum(s.pint_price) filter (where s.pint_price is not null),
      0
    )::numeric,
    coalesce(
      sum(s.pint_price) filter (
        where s.pint_price is not null
          and s.email is not null
          and lower(trim(s.email::text))
            = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      ),
      0
    )::numeric
  from public.scores s
  where s.bar_name is not null
    and trim(s.bar_name) <> ''
    and lower(trim(s.bar_name::text)) = lower(trim(p_bar_key));
$$;

comment on function public.pub_extra_stats_for_bar(text) is
  'Pour authors (distinct email or session), total pint_price sum, and current user pint spend for a bar.';

revoke all on function public.pub_extra_stats_for_bar(text) from public;
grant execute on function public.pub_extra_stats_for_bar(text) to anon, authenticated;
