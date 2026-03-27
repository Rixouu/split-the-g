-- Public display names, friend requests, friendships, competition visibility + email invites, updated RLS.

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- public_profiles (minimal; app upserts on login)
-- ---------------------------------------------------------------------------
create table if not exists public.public_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.public_profiles enable row level security;

drop policy if exists "public_profiles_select_all" on public.public_profiles;
create policy "public_profiles_select_all"
  on public.public_profiles for select
  using (true);

drop policy if exists "public_profiles_insert_own" on public.public_profiles;
create policy "public_profiles_insert_own"
  on public.public_profiles for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "public_profiles_update_own" on public.public_profiles;
create policy "public_profiles_update_own"
  on public.public_profiles for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select on public.public_profiles to anon, authenticated;
grant insert, update on public.public_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- friend_requests
-- ---------------------------------------------------------------------------
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users (id) on delete cascade,
  to_email citext not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists friend_requests_one_pending_per_pair
  on public.friend_requests (from_user_id, lower(to_email::text))
  where status = 'pending';

alter table public.friend_requests enable row level security;

drop policy if exists "friend_requests_select" on public.friend_requests;
create policy "friend_requests_select"
  on public.friend_requests for select to authenticated
  using (
    from_user_id = auth.uid()
    or lower(trim(to_email::text)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  );

drop policy if exists "friend_requests_insert" on public.friend_requests;
create policy "friend_requests_insert"
  on public.friend_requests for insert to authenticated
  with check (from_user_id = auth.uid());

drop policy if exists "friend_requests_update" on public.friend_requests;
create policy "friend_requests_update"
  on public.friend_requests for update to authenticated
  using (
    from_user_id = auth.uid()
    or lower(trim(to_email::text)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  );

grant select, insert, update on public.friend_requests to authenticated;

-- ---------------------------------------------------------------------------
-- user_friends (symmetric: app inserts two rows on accept)
-- ---------------------------------------------------------------------------
create table if not exists public.user_friends (
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_user_id uuid not null references auth.users (id) on delete cascade,
  peer_email citext,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, friend_user_id),
  constraint user_friends_no_self check (user_id <> friend_user_id)
);

alter table public.user_friends enable row level security;

drop policy if exists "user_friends_select" on public.user_friends;
create policy "user_friends_select"
  on public.user_friends for select to authenticated
  using (user_id = auth.uid() or friend_user_id = auth.uid());

drop policy if exists "user_friends_insert" on public.user_friends;
create policy "user_friends_insert"
  on public.user_friends for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_friends_delete" on public.user_friends;
create policy "user_friends_delete"
  on public.user_friends for delete to authenticated
  using (user_id = auth.uid() or friend_user_id = auth.uid());

grant select, insert, delete on public.user_friends to authenticated;

-- ---------------------------------------------------------------------------
-- competitions.visibility
-- ---------------------------------------------------------------------------
alter table public.competitions
  add column if not exists visibility text not null default 'public'
  constraint competitions_visibility_check check (visibility in ('public', 'private'));

-- ---------------------------------------------------------------------------
-- competition_invites
-- ---------------------------------------------------------------------------
create table if not exists public.competition_invites (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  invited_email citext not null,
  invited_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists competition_invites_comp_email_uq
  on public.competition_invites (competition_id, lower(invited_email::text));

alter table public.competition_invites enable row level security;

drop policy if exists "competition_invites_select" on public.competition_invites;
create policy "competition_invites_select"
  on public.competition_invites for select to authenticated
  using (
    exists (
      select 1 from public.competitions c
      where c.id = competition_id and c.created_by = auth.uid()
    )
    or lower(trim(invited_email::text)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  );

drop policy if exists "competition_invites_insert" on public.competition_invites;
create policy "competition_invites_insert"
  on public.competition_invites for insert to authenticated
  with check (
    invited_by = auth.uid()
    and exists (
      select 1 from public.competitions c
      where c.id = competition_id and c.created_by = auth.uid()
    )
  );

drop policy if exists "competition_invites_delete" on public.competition_invites;
create policy "competition_invites_delete"
  on public.competition_invites for delete to authenticated
  using (
    exists (
      select 1 from public.competitions c
      where c.id = competition_id and c.created_by = auth.uid()
    )
  );

grant select, insert, delete on public.competition_invites to authenticated;

-- ---------------------------------------------------------------------------
-- competitions: replace open read with visibility-aware
-- ---------------------------------------------------------------------------
drop policy if exists "competitions_read_all" on public.competitions;
create policy "competitions_select_visible"
  on public.competitions for select
  using (
    visibility = 'public'
    or (
      auth.uid() is not null
      and created_by = auth.uid()
    )
    or (
      auth.uid() is not null
      and exists (
        select 1 from public.competition_participants p
        where p.competition_id = competitions.id
          and p.user_id = auth.uid()
      )
    )
    or (
      auth.uid() is not null
      and exists (
        select 1 from public.competition_invites i
        where i.competition_id = competitions.id
          and lower(trim(i.invited_email::text))
            = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      )
    )
  );

-- ---------------------------------------------------------------------------
-- competition_participants: self-join, invite email, or owner + friend
-- ---------------------------------------------------------------------------
drop policy if exists "competition_participants_insert_self" on public.competition_participants;
drop policy if exists "competition_participants_insert" on public.competition_participants;

create policy "competition_participants_insert"
  on public.competition_participants for insert to authenticated
  with check (
    (
      user_id = auth.uid()
      and (
        exists (
          select 1 from public.competitions c
          where c.id = competition_id and c.visibility = 'public'
        )
        or exists (
          select 1 from public.competition_invites i
          where i.competition_id = competition_participants.competition_id
            and lower(trim(i.invited_email::text))
              = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        )
      )
    )
    or (
      exists (
        select 1 from public.competitions c
        where c.id = competition_id and c.created_by = auth.uid()
      )
      and exists (
        select 1 from public.user_friends f
        where (
            f.user_id = auth.uid()
            and f.friend_user_id = competition_participants.user_id
          )
          or (
            f.friend_user_id = auth.uid()
            and f.user_id = competition_participants.user_id
          )
      )
    )
  );
