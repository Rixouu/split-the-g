-- Competitions (authenticated create), favorites (per user), bar aggregates for Pubs tab.

create table if not exists public.competitions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  max_participants int not null check (max_participants > 0),
  glasses_per_person int not null check (glasses_per_person > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  win_rule text not null default 'highest_score' check (win_rule = 'highest_score'),
  created_at timestamptz not null default timezone('utc', now()),
  constraint competitions_ends_after_start check (ends_at > starts_at)
);

alter table public.competitions enable row level security;

drop policy if exists "competitions_read_all" on public.competitions;
create policy "competitions_read_all"
  on public.competitions for select
  using (true);

drop policy if exists "competitions_insert_own" on public.competitions;
create policy "competitions_insert_own"
  on public.competitions for insert to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "competitions_update_own" on public.competitions;
create policy "competitions_update_own"
  on public.competitions for update to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

grant select on public.competitions to anon, authenticated;
grant insert, update on public.competitions to authenticated;

create table if not exists public.competition_participants (
  competition_id uuid not null references public.competitions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (competition_id, user_id)
);

alter table public.competition_participants enable row level security;

drop policy if exists "competition_participants_read" on public.competition_participants;
create policy "competition_participants_read"
  on public.competition_participants for select
  using (true);

drop policy if exists "competition_participants_insert_self" on public.competition_participants;
create policy "competition_participants_insert_self"
  on public.competition_participants for insert to authenticated
  with check (auth.uid() = user_id);

grant select on public.competition_participants to anon, authenticated;
grant insert on public.competition_participants to authenticated;

create table if not exists public.competition_scores (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  score_id uuid not null references public.scores (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (competition_id, score_id)
);

alter table public.competition_scores enable row level security;

drop policy if exists "competition_scores_read" on public.competition_scores;
create policy "competition_scores_read"
  on public.competition_scores for select
  using (true);

drop policy if exists "competition_scores_insert_auth" on public.competition_scores;
create policy "competition_scores_insert_auth"
  on public.competition_scores for insert to authenticated
  with check (user_id is null or auth.uid() = user_id);

grant select on public.competition_scores to anon, authenticated;
grant insert on public.competition_scores to authenticated;

create table if not exists public.user_favorite_bars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bar_name text not null,
  bar_address text,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists user_favorite_bars_user_bar_uq
  on public.user_favorite_bars (user_id, lower(trim(bar_name)));

alter table public.user_favorite_bars enable row level security;

drop policy if exists "user_favorite_bars_select_own" on public.user_favorite_bars;
create policy "user_favorite_bars_select_own"
  on public.user_favorite_bars for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_favorite_bars_insert_own" on public.user_favorite_bars;
create policy "user_favorite_bars_insert_own"
  on public.user_favorite_bars for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_favorite_bars_delete_own" on public.user_favorite_bars;
create policy "user_favorite_bars_delete_own"
  on public.user_favorite_bars for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on public.user_favorite_bars to authenticated;

create or replace view public.bar_pub_stats as
select
  lower(trim(bar_name)) as bar_key,
  max(bar_name) as display_name,
  max(bar_address) filter (
    where bar_address is not null and trim(bar_address) <> ''
  ) as sample_address,
  round(avg(pour_rating)::numeric, 2) as avg_pour_rating,
  count(*) filter (where pour_rating is not null)::bigint as rating_count,
  count(*)::bigint as submission_count
from public.scores
where bar_name is not null and trim(bar_name) <> ''
group by lower(trim(bar_name));

grant select on public.bar_pub_stats to anon, authenticated;
