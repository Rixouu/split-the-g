-- Allow competition owners to delete competitions; allow users to leave (delete own participant row).

drop policy if exists "competitions_delete_own" on public.competitions;
create policy "competitions_delete_own"
  on public.competitions for delete to authenticated
  using (auth.uid() = created_by);

grant delete on public.competitions to authenticated;

drop policy if exists "competition_participants_delete_self" on public.competition_participants;
create policy "competition_participants_delete_self"
  on public.competition_participants for delete to authenticated
  using (auth.uid() = user_id);

grant delete on public.competition_participants to authenticated;
