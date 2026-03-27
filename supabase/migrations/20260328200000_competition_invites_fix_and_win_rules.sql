-- Repair invalid table UNIQUE on expression (use unique index instead).
-- Extend competition win rules + target score.
-- Tighten competition_scores RLS (read by competition visibility; insert for participants in window).

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- competition_invites: ensure table exists without expression UNIQUE
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
-- competitions.win_rule + target_score
-- ---------------------------------------------------------------------------
alter table public.competitions drop constraint if exists competitions_win_rule_check;

alter table public.competitions add constraint competitions_win_rule_check check (
  win_rule in ('highest_score', 'closest_to_target', 'most_submissions')
);

alter table public.competitions add column if not exists target_score numeric(4,2);

alter table public.competitions drop constraint if exists competitions_target_score_range;
alter table public.competitions add constraint competitions_target_score_range check (
  target_score is null or (target_score >= 0 and target_score <= 5)
);

alter table public.competitions drop constraint if exists competitions_closest_requires_target;
alter table public.competitions add constraint competitions_closest_requires_target check (
  win_rule <> 'closest_to_target' or target_score is not null
);

-- ---------------------------------------------------------------------------
-- competition_scores: visibility-aware read; participant-only insert in window
-- ---------------------------------------------------------------------------
drop policy if exists "competition_scores_read" on public.competition_scores;
create policy "competition_scores_read"
  on public.competition_scores for select
  using (
    exists (
      select 1 from public.competitions c
      where c.id = competition_scores.competition_id
        and (
          c.visibility = 'public'
          or (
            auth.uid() is not null
            and c.created_by = auth.uid()
          )
          or (
            auth.uid() is not null
            and exists (
              select 1 from public.competition_participants p
              where p.competition_id = c.id
                and p.user_id = auth.uid()
            )
          )
          or (
            auth.uid() is not null
            and exists (
              select 1 from public.competition_invites i
              where i.competition_id = c.id
                and lower(trim(i.invited_email::text))
                  = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
            )
          )
        )
    )
  );

drop policy if exists "competition_scores_insert_auth" on public.competition_scores;
create policy "competition_scores_insert_auth"
  on public.competition_scores for insert to authenticated
  with check (
    user_id = auth.uid()
    and user_id is not null
    and exists (
      select 1 from public.competition_participants p
      where p.competition_id = competition_scores.competition_id
        and p.user_id = auth.uid()
    )
    and exists (
      select 1 from public.competitions c
      where c.id = competition_scores.competition_id
        and timezone('utc', now()) >= c.starts_at
        and timezone('utc', now()) <= c.ends_at
    )
    and exists (
      select 1 from public.scores s
      where s.id = competition_scores.score_id
        and lower(trim(coalesce(s.email, '')))
          = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    )
  );
