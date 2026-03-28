-- Withdraw pending invites via UPDATE (sender already allowed by friend_requests_update RLS).
-- DELETE is optional and was easy to miss in deploy; UPDATE works with the original grants.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'friend_requests'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
      AND pg_get_constraintdef(c.oid) ILIKE '%pending%'
  LOOP
    EXECUTE format('ALTER TABLE public.friend_requests DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.friend_requests
  ADD CONSTRAINT friend_requests_status_check
  CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn'));
