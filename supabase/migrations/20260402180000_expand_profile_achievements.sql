-- Twelve additional achievement codes (stickers 9–20), awarded on score writes.

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
  v_best numeric := 0;
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

  select count(*)::int into v_total
  from public.scores s
  where lower(trim(coalesce(s.email, ''))) = v_email;

  if v_total >= 5 then
    insert into public.user_achievements (user_id, code) values (v_uid, 'pints-5')
    on conflict (user_id, code) do nothing;
  end if;
  if v_total >= 10 then
    insert into public.user_achievements (user_id, code) values (v_uid, 'pints-10')
    on conflict (user_id, code) do nothing;
  end if;
  if v_total >= 25 then
    insert into public.user_achievements (user_id, code) values (v_uid, 'pints-25')
    on conflict (user_id, code) do nothing;
  end if;
  if v_total >= 50 then
    insert into public.user_achievements (user_id, code) values (v_uid, 'pints-50')
    on conflict (user_id, code) do nothing;
  end if;
  if v_total >= 75 then
    insert into public.user_achievements (user_id, code) values (v_uid, 'pints-75')
    on conflict (user_id, code) do nothing;
  end if;
  if v_total >= 100 then
    insert into public.user_achievements (user_id, code) values (v_uid, 'pints-100')
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
  if v_unique_pubs >= 10 then
    insert into public.user_achievements (user_id, code) values (v_uid, 'pub-crawler-10')
    on conflict (user_id, code) do nothing;
  end if;
  if v_unique_pubs >= 15 then
    insert into public.user_achievements (user_id, code) values (v_uid, 'pub-crawler-15')
    on conflict (user_id, code) do nothing;
  end if;
  if v_unique_pubs >= 20 then
    insert into public.user_achievements (user_id, code) values (v_uid, 'pub-crawler-20')
    on conflict (user_id, code) do nothing;
  end if;

  select coalesce(max(s.split_score), 0) into v_best
  from public.scores s
  where lower(trim(coalesce(s.email, ''))) = v_email;

  if v_best >= 4.5 then
    insert into public.user_achievements (user_id, code)
    values (v_uid, 'high-split-4-5', jsonb_build_object('best', v_best))
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
    where us.user_id = v_uid and us.daily_streak >= 14
  ) then
    insert into public.user_achievements (user_id, code) values (v_uid, 'daily-streak-14')
    on conflict (user_id, code) do nothing;
  end if;

  if exists (
    select 1
    from public.user_streak_snapshots us
    where us.user_id = v_uid and us.daily_streak >= 30
  ) then
    insert into public.user_achievements (user_id, code) values (v_uid, 'daily-streak-30')
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

  if exists (
    select 1
    from public.user_streak_snapshots us
    where us.user_id = v_uid and us.weekend_streak >= 6
  ) then
    insert into public.user_achievements (user_id, code) values (v_uid, 'weekend-warrior-6')
    on conflict (user_id, code) do nothing;
  end if;

  if exists (
    select 1
    from public.user_streak_snapshots us
    where us.user_id = v_uid and us.weekly_streak >= 4
  ) then
    insert into public.user_achievements (user_id, code) values (v_uid, 'weekly-streak-4')
    on conflict (user_id, code) do nothing;
  end if;

  return new;
end;
$$;
