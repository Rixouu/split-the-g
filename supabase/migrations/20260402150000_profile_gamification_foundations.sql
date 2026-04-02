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

create or replace function public.recompute_user_streak_snapshot(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_daily int := 0;
  v_weekly int := 0;
  v_weekend int := 0;
  v_probe date;
  v_key text;
begin
  select lower(trim(email)) into v_email
  from auth.users
  where id = p_user_id;

  if v_email is null or v_email = '' then
    return;
  end if;

  -- Daily streak
  v_daily := 0;
  v_probe := current_date;
  for i in 0..400 loop
    v_key := to_char(v_probe, 'YYYY-MM-DD');
    if exists (
      select 1
      from public.scores s
      where lower(trim(coalesce(s.email, ''))) = v_email
        and (s.created_at at time zone 'utc')::date = v_probe
    ) then
      v_daily := v_daily + 1;
      v_probe := v_probe - 1;
    else
      exit;
    end if;
  end loop;

  -- Weekly streak (ISO week buckets, anchored to current week start Monday)
  v_probe := date_trunc('week', current_date::timestamp)::date;
  v_weekly := 0;
  for i in 0..120 loop
    if exists (
      select 1
      from public.scores s
      where lower(trim(coalesce(s.email, ''))) = v_email
        and (s.created_at at time zone 'utc')::date >= v_probe
        and (s.created_at at time zone 'utc')::date < (v_probe + interval '7 day')::date
    ) then
      v_weekly := v_weekly + 1;
      v_probe := (v_probe - interval '7 day')::date;
    else
      exit;
    end if;
  end loop;

  -- Weekend streak (Sat/Sun pairs)
  v_probe := current_date - (extract(dow from current_date)::int + 1) % 7;
  v_weekend := 0;
  for i in 0..120 loop
    if exists (
      select 1
      from public.scores s
      where lower(trim(coalesce(s.email, ''))) = v_email
        and (s.created_at at time zone 'utc')::date >= v_probe
        and (s.created_at at time zone 'utc')::date < (v_probe + interval '2 day')::date
    ) then
      v_weekend := v_weekend + 1;
      v_probe := (v_probe - interval '7 day')::date;
    else
      exit;
    end if;
  end loop;

  insert into public.user_streak_snapshots (
    user_id,
    daily_streak,
    weekly_streak,
    weekend_streak,
    last_computed_at
  )
  values (p_user_id, v_daily, v_weekly, v_weekend, timezone('utc', now()))
  on conflict (user_id) do update
    set daily_streak = excluded.daily_streak,
        weekly_streak = excluded.weekly_streak,
        weekend_streak = excluded.weekend_streak,
        last_computed_at = excluded.last_computed_at;
end;
$$;

create or replace function public.award_achievements_for_score_row()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_uid uuid;
  v_total int := 0;
  v_unique_pubs int := 0;
  v_avg numeric := 0;
begin
  v_email := lower(trim(coalesce(new.email, '')));
  if v_email = '' then
    return new;
  end if;

  select id into v_uid
  from auth.users
  where lower(trim(email)) = v_email
  limit 1;

  if v_uid is null then
    return new;
  end if;

  -- Core one-shot achievements from the current row
  if coalesce(new.split_score, 0) >= 4.95 then
    insert into public.user_achievements (user_id, code, metadata)
    values (v_uid, 'perfect-score', jsonb_build_object('score_id', new.id, 'score', new.split_score))
    on conflict (user_id, code) do nothing;
  end if;

  if extract(hour from (new.created_at at time zone 'utc')) < 17 then
    insert into public.user_achievements (user_id, code, metadata)
    values (v_uid, 'early-bird', jsonb_build_object('score_id', new.id))
    on conflict (user_id, code) do nothing;
  end if;

  -- Aggregate achievements
  select count(*)::int into v_total
  from public.scores s
  where lower(trim(coalesce(s.email, ''))) = v_email;

  if v_total >= 10 then
    insert into public.user_achievements (user_id, code) values (v_uid, 'pints-10')
    on conflict (user_id, code) do nothing;
  end if;
  if v_total >= 25 then
    insert into public.user_achievements (user_id, code) values (v_uid, 'pints-25')
    on conflict (user_id, code) do nothing;
  end if;

  select count(distinct lower(trim(coalesce(s.bar_name, ''))))::int into v_unique_pubs
  from public.scores s
  where lower(trim(coalesce(s.email, ''))) = v_email
    and trim(coalesce(s.bar_name, '')) <> '';

  if v_unique_pubs >= 5 then
    insert into public.user_achievements (user_id, code) values (v_uid, 'pub-crawler-5')
    on conflict (user_id, code) do nothing;
  end if;

  select coalesce(avg(s.split_score), 0) into v_avg
  from public.scores s
  where lower(trim(coalesce(s.email, ''))) = v_email;

  if v_total >= 10 and v_avg >= 4.3 then
    insert into public.user_achievements (user_id, code)
    values (v_uid, 'elite-average')
    on conflict (user_id, code) do nothing;
  end if;

  perform public.recompute_user_streak_snapshot(v_uid);

  if exists (
    select 1
    from public.user_streak_snapshots us
    where us.user_id = v_uid and us.daily_streak >= 7
  ) then
    insert into public.user_achievements (user_id, code) values (v_uid, 'daily-streak-7')
    on conflict (user_id, code) do nothing;
  end if;

  if exists (
    select 1
    from public.user_streak_snapshots us
    where us.user_id = v_uid and us.weekend_streak >= 3
  ) then
    insert into public.user_achievements (user_id, code) values (v_uid, 'weekend-warrior-3')
    on conflict (user_id, code) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists scores_award_achievements_trg on public.scores;
create trigger scores_award_achievements_trg
after insert or update of email, split_score, created_at, bar_name
on public.scores
for each row
execute function public.award_achievements_for_score_row();
