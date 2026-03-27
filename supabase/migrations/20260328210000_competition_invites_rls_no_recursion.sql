-- Break RLS cycle: competitions_select_visible references competition_invites,
-- while competition_invites_select referenced competitions (re-applying competitions RLS).
-- Owner visibility for invites uses invited_by = auth.uid() (invites are always created by the owner).

drop policy if exists "competition_invites_select" on public.competition_invites;
create policy "competition_invites_select"
  on public.competition_invites for select to authenticated
  using (
    invited_by = auth.uid()
    or lower(trim(invited_email::text))
      = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  );
