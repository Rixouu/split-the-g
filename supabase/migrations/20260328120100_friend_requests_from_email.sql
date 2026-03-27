alter table public.friend_requests
  add column if not exists from_email citext;
