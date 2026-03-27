-- Claim with Google uses Supabase JWT role `authenticated`, not `anon`.
-- Without these grants + SELECT policy, update().select() fails (no row / permission denied).

grant select, insert, update on public.scores to authenticated;

drop policy if exists "Allow authenticated read access" on public.scores;
create policy "Allow authenticated read access"
  on public.scores for select to authenticated using (true);
