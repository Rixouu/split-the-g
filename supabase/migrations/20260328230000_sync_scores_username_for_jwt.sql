-- Case-insensitive sync of scores.username to the signed-in user's JWT email.
-- Fixes leaderboard display when scores.email casing differs from auth.jwt() email
-- (direct .eq("email", user.email) updates zero rows).

create or replace function public.sync_scores_username_for_jwt(p_username text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_email text := nullif(
    trim(lower(coalesce(auth.jwt() ->> 'email', ''))),
    ''
  );
  n int := 0;
begin
  if jwt_email is null then
    return 0;
  end if;

  update public.scores
  set username = coalesce(nullif(trim(p_username), ''), username)
  where email is not null
    and lower(trim(email::text)) = jwt_email;

  get diagnostics n = row_count;
  return n;
end;
$$;

comment on function public.sync_scores_username_for_jwt(text) is
  'Sets scores.username for all rows whose email matches JWT email (case-insensitive).';

revoke all on function public.sync_scores_username_for_jwt(text) from public;
grant execute on function public.sync_scores_username_for_jwt(text) to authenticated;
