-- Allow senders to withdraw (delete) their own pending friend requests.

drop policy if exists "friend_requests_delete" on public.friend_requests;
create policy "friend_requests_delete"
  on public.friend_requests for delete to authenticated
  using (from_user_id = auth.uid() and status = 'pending');

grant delete on public.friend_requests to authenticated;
