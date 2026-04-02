-- Foundations for persistent gamification.

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null,
  unlocked_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, code)
);

comment on table public.user_achievements is
  'Persistent achievement unlocks (badges) for profile gamification.';

alter table public.user_achievements enable row level security;

drop policy if exists "user_achievements_select_own" on public.user_achievements;
create policy "user_achievements_select_own"
  on public.user_achievements for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_achievements_insert_own" on public.user_achievements;
create policy "user_achievements_insert_own"
  on public.user_achievements for insert to authenticated
  with check (auth.uid() = user_id);

grant select, insert on public.user_achievements to authenticated;

create table if not exists public.user_streak_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  daily_streak int not null default 0,
  weekly_streak int not null default 0,
  weekend_streak int not null default 0,
  last_computed_at timestamptz not null default timezone('utc', now())
);

comment on table public.user_streak_snapshots is
  'Optional cached streak counters for profile surfaces.';

alter table public.user_streak_snapshots enable row level security;

drop policy if exists "user_streak_snapshots_select_own" on public.user_streak_snapshots;
create policy "user_streak_snapshots_select_own"
  on public.user_streak_snapshots for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_streak_snapshots_upsert_own" on public.user_streak_snapshots;
create policy "user_streak_snapshots_upsert_own"
  on public.user_streak_snapshots for insert to authenticated
  with check (auth.uid() = user_id);

grant select, insert on public.user_streak_snapshots to authenticated;
