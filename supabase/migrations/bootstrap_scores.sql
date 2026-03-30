-- Run in Supabase → SQL Editor if public.scores is missing (empty/new project).
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS where needed.

create extension if not exists "uuid-ossp";

create table if not exists public.scores (
    id uuid primary key default uuid_generate_v4(),
    username text not null,
    split_score numeric(4,2) not null check (split_score >= 0 and split_score <= 5),
    created_at timestamptz default timezone('UTC'::text, now()),
    split_image_url text,
    pint_image_url text,
    g_closeup_image_url text,
    email text,
    email_opted_out boolean default false,
    session_id uuid,
    city text,
    region text,
    country text,
    country_code text,
    bar_name text,
    pour_rating decimal(3,2),
    bar_address text,
    slug text
);

create unique index if not exists scores_slug_unique
  on public.scores (slug)
  where slug is not null and trim(slug) <> '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'scores_pour_rating_check'
  ) then
    alter table public.scores
      add constraint scores_pour_rating_check
      check (pour_rating is null or (pour_rating >= 0 and pour_rating <= 5));
  end if;
end $$;

alter table public.scores enable row level security;

drop policy if exists "Allow anonymous read access" on public.scores;
create policy "Allow anonymous read access"
  on public.scores for select to anon using (true);

drop policy if exists "Allow authenticated read access" on public.scores;
create policy "Allow authenticated read access"
  on public.scores for select to authenticated using (true);

drop policy if exists "Allow anonymous inserts" on public.scores;
create policy "Allow anonymous inserts"
  on public.scores for insert to anon with check (true);

drop policy if exists "Allow email updates" on public.scores;
create policy "Allow email updates"
  on public.scores for update using (true) with check (true);

create index if not exists scores_split_score_idx on public.scores (split_score desc);
create index if not exists scores_created_at_idx on public.scores (created_at desc);
create index if not exists scores_session_id_idx on public.scores (session_id);

comment on table public.scores is 'Stores Split the G scores and user information';

insert into storage.buckets (id, name, public)
values ('split-g-images', 'split-g-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "split_g_images_public_read" on storage.objects;
create policy "split_g_images_public_read"
  on storage.objects for select to public
  using (bucket_id = 'split-g-images');

drop policy if exists "split_g_images_anon_insert" on storage.objects;
create policy "split_g_images_anon_insert"
  on storage.objects for insert to anon
  with check (bucket_id = 'split-g-images');

create or replace function public.get_country_stats_24h()
returns table (
  country text,
  country_code text,
  submission_count bigint,
  average_score numeric
)
language sql
security invoker
as $$
  select
    s.country,
    s.country_code,
    count(*)::bigint as submission_count,
    avg(s.split_score) as average_score
  from scores s
  where s.country is not null
    and s.created_at >= now() - interval '24 hours'
  group by s.country, s.country_code
  order by submission_count desc;
$$;

create or replace function public.get_country_stats_all_time()
returns table (
  country text,
  country_code text,
  submission_count bigint,
  average_score numeric
)
language sql
security invoker
as $$
  select
    s.country,
    s.country_code,
    count(*)::bigint as submission_count,
    avg(s.split_score) as average_score
  from scores s
  where s.country is not null
  group by s.country, s.country_code
  order by submission_count desc;
$$;

create or replace function public.get_bar_stats()
returns table(bar_with_region text, distinct_count bigint, average_pour_score numeric)
language sql
security definer
set search_path = public
as $$
  select
    concat(lower(replace(bar_name, '''', '')), ' (', region, ')') as bar_with_region,
    count(*)::bigint as distinct_count,
    round(avg(pour_rating), 2) as average_pour_score
  from scores
  where pour_rating is not null
  group by lower(replace(bar_name, '''', '')), region
  having count(*) > 1
  order by distinct_count desc;
$$;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.scores to anon;
grant select, insert, update on public.scores to authenticated;
grant execute on function public.get_country_stats_24h() to anon, authenticated;
grant execute on function public.get_country_stats_all_time() to anon, authenticated;
grant execute on function public.get_bar_stats() to anon, authenticated;
