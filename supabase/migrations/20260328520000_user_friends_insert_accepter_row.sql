-- Accept flow inserts two symmetric rows. Original policy only allowed user_id = auth.uid(),
-- so the row (requester_id, accepter_id) was rejected for the accepter's session.
-- Allow that row when an accepted friend_request ties the requester to the accepter's JWT email.

drop policy if exists "user_friends_insert" on public.user_friends;

create policy "user_friends_insert"
  on public.user_friends for insert to authenticated
  with check (
    user_id = auth.uid()
    or (
      friend_user_id = auth.uid()
      and exists (
        select 1
        from public.friend_requests fr
        where fr.from_user_id = user_friends.user_id
          and lower(trim(fr.to_email::text))
            = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
          and fr.status = 'accepted'
      )
    )
  );
