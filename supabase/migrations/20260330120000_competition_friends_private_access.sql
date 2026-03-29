-- Friends of the host can see private competitions, view scores, and self-join
-- (mirrors app expectation that private comps are shared among friends).

drop policy if exists "competitions_select_visible" on public.competitions;
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
    or (
      auth.uid() is not null
      and visibility = 'private'
      and exists (
        select 1 from public.user_friends f
        where (
          (f.user_id = auth.uid() and f.friend_user_id = competitions.created_by)
          or (f.friend_user_id = auth.uid() and f.user_id = competitions.created_by)
        )
      )
    )
  );

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
          or (
            auth.uid() is not null
            and c.visibility = 'private'
            and exists (
              select 1 from public.user_friends f
              where (
                (f.user_id = auth.uid() and f.friend_user_id = c.created_by)
                or (f.friend_user_id = auth.uid() and f.user_id = c.created_by)
              )
            )
          )
        )
    )
  );

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
        or exists (
          select 1 from public.competitions c
          where c.id = competition_participants.competition_id
            and c.visibility = 'private'
            and exists (
              select 1 from public.user_friends f
              where (
                (f.user_id = auth.uid() and f.friend_user_id = c.created_by)
                or (f.friend_user_id = auth.uid() and f.user_id = c.created_by)
              )
            )
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
