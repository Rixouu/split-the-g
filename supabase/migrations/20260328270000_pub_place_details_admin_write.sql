-- Only the directory admin may insert/update pub_place_details (matches app gate).

drop policy if exists "pub_place_details_insert_auth" on public.pub_place_details;
drop policy if exists "pub_place_details_update_auth" on public.pub_place_details;

create policy "pub_place_details_insert_admin"
  on public.pub_place_details for insert to authenticated
  with check (
    lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      = lower(trim('admin.rixou@gmail.com'))
  );

create policy "pub_place_details_update_admin"
  on public.pub_place_details for update to authenticated
  using (
    lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      = lower(trim('admin.rixou@gmail.com'))
  )
  with check (
    lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      = lower(trim('admin.rixou@gmail.com'))
  );
