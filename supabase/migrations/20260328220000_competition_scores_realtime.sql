-- Broadcast INSERT on competition_scores to authenticated clients who can read the row (RLS).
-- Enables in-app toasts when another participant submits a pour.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'competition_scores'
  ) then
    alter publication supabase_realtime add table public.competition_scores;
  end if;
end $$;
