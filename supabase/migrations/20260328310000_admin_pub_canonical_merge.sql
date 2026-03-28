-- Admin-only RPCs: apply Google/canonical name+address to all pours for a bar_key,
-- and merge a duplicate pub (manual name) into an existing canonical pub.

create or replace function public.admin_apply_pub_canonical_on_scores(
  p_current_bar_key text,
  p_bar_name text,
  p_bar_address text,
  p_google_place_id text
)
returns table(new_bar_key text, pour_rows_updated bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin constant text := lower(trim('admin.rixou@gmail.com'));
  v_jwt text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_old text := lower(btrim(p_current_bar_key));
  v_name text := btrim(p_bar_name);
  v_new text;
  v_addr text := nullif(btrim(coalesce(p_bar_address, '')), '');
  v_pid text := nullif(btrim(coalesce(p_google_place_id, '')), '');
  n bigint;
begin
  if v_jwt is null or v_jwt <> v_admin then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_old = '' or v_name = '' then
    raise exception 'current_bar_key and bar_name are required' using errcode = '22023';
  end if;

  v_new := lower(v_name);

  update public.scores s
  set
    bar_name = v_name,
    bar_address = case
      when v_addr is not null then v_addr
      else s.bar_address
    end,
    google_place_id = coalesce(v_pid, s.google_place_id)
  where lower(btrim(s.bar_name)) = v_old;

  get diagnostics n = row_count;

  if v_new <> v_old then
    delete from public.user_favorite_bars u_old
    using public.user_favorite_bars u_new
    where lower(btrim(u_old.bar_name)) = v_old
      and lower(btrim(u_new.bar_name)) = v_new
      and u_old.user_id = u_new.user_id;

    update public.user_favorite_bars
    set
      bar_name = v_name,
      bar_address = case
        when v_addr is not null then v_addr
        else bar_address
      end
    where lower(btrim(bar_name)) = v_old;

    update public.competitions
    set linked_bar_key = v_new
    where linked_bar_key is not null
      and lower(btrim(linked_bar_key)) = v_old;

    if exists (
      select 1 from public.pub_place_details where bar_key = v_new
    ) and exists (
      select 1 from public.pub_place_details where bar_key = v_old
    ) then
      update public.pub_place_details t
      set
        opening_hours = coalesce(nullif(btrim(t.opening_hours), ''), s.opening_hours),
        guinness_info = coalesce(nullif(btrim(t.guinness_info), ''), s.guinness_info),
        alcohol_promotions = coalesce(
          nullif(btrim(t.alcohol_promotions), ''),
          s.alcohol_promotions
        ),
        maps_place_url = coalesce(nullif(btrim(t.maps_place_url), ''), s.maps_place_url),
        google_place_id = coalesce(nullif(btrim(t.google_place_id), ''), s.google_place_id)
      from public.pub_place_details s
      where t.bar_key = v_new
        and s.bar_key = v_old;
      delete from public.pub_place_details where bar_key = v_old;
    elsif exists (select 1 from public.pub_place_details where bar_key = v_old) then
      update public.pub_place_details
      set bar_key = v_new
      where bar_key = v_old;
    end if;
  end if;

  new_bar_key := v_new;
  pour_rows_updated := n;
  return next;
end;
$$;

comment on function public.admin_apply_pub_canonical_on_scores(text, text, text, text) is
  'Directory admin: set bar_name/bar_address/google_place_id on all scores for p_current_bar_key; migrate pub_place_details, favorites, comps when normalized key changes.';

create or replace function public.admin_merge_pub_into_target(
  p_source_bar_key text,
  p_target_bar_key text
)
returns table(pour_rows_merged bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin constant text := lower(trim('admin.rixou@gmail.com'));
  v_jwt text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_src text := lower(btrim(p_source_bar_key));
  v_tgt text := lower(btrim(p_target_bar_key));
  v_tname text;
  v_taddr text;
  v_tpid text;
  n bigint;
begin
  if v_jwt is null or v_jwt <> v_admin then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_src = '' or v_tgt = '' then
    raise exception 'source and target bar keys are required' using errcode = '22023';
  end if;
  if v_src = v_tgt then
    raise exception 'source and target must differ' using errcode = '22023';
  end if;

  select
    max(s.bar_name)::text,
    max(s.bar_address) filter (
      where s.bar_address is not null and btrim(s.bar_address) <> ''
    ),
    max(s.google_place_id) filter (
      where s.google_place_id is not null and btrim(s.google_place_id) <> ''
    )
  into v_tname, v_taddr, v_tpid
  from public.scores s
  where lower(btrim(s.bar_name)) = v_tgt;

  if v_tname is null or btrim(v_tname) = '' then
    raise exception 'target pub has no scores (unknown target)' using errcode = '22023';
  end if;

  update public.scores s
  set
    bar_name = v_tname,
    bar_address = case
      when v_taddr is not null then v_taddr
      else s.bar_address
    end,
    google_place_id = coalesce(nullif(btrim(s.google_place_id), ''), v_tpid)
  where lower(btrim(s.bar_name)) = v_src;

  get diagnostics n = row_count;

  if n = 0 then
    raise exception 'no pours found for this pub (check source bar key)' using errcode = '22023';
  end if;

  delete from public.user_favorite_bars u_old
  using public.user_favorite_bars u_new
  where lower(btrim(u_old.bar_name)) = v_src
    and lower(btrim(u_new.bar_name)) = v_tgt
    and u_old.user_id = u_new.user_id;

  update public.user_favorite_bars
  set
    bar_name = v_tname,
    bar_address = case
      when v_taddr is not null then v_taddr
      else bar_address
    end
  where lower(btrim(bar_name)) = v_src;

  update public.competitions
  set linked_bar_key = v_tgt
  where linked_bar_key is not null
    and lower(btrim(linked_bar_key)) = v_src;

  if exists (
    select 1 from public.pub_place_details where bar_key = v_tgt
  ) and exists (
    select 1 from public.pub_place_details where bar_key = v_src
  ) then
    update public.pub_place_details t
    set
      opening_hours = coalesce(nullif(btrim(t.opening_hours), ''), s.opening_hours),
      guinness_info = coalesce(nullif(btrim(t.guinness_info), ''), s.guinness_info),
      alcohol_promotions = coalesce(
        nullif(btrim(t.alcohol_promotions), ''),
        s.alcohol_promotions
      ),
      maps_place_url = coalesce(nullif(btrim(t.maps_place_url), ''), s.maps_place_url),
      google_place_id = coalesce(nullif(btrim(t.google_place_id), ''), s.google_place_id)
    from public.pub_place_details s
    where t.bar_key = v_tgt
      and s.bar_key = v_src;
    delete from public.pub_place_details where bar_key = v_src;
  elsif exists (select 1 from public.pub_place_details where bar_key = v_src) then
    update public.pub_place_details
    set bar_key = v_tgt
    where bar_key = v_src;
  end if;

  pour_rows_merged := n;
  return next;
end;
$$;

comment on function public.admin_merge_pub_into_target(text, text) is
  'Directory admin: re-tag all pours from source bar_key to match target pub name/address/place id; merge directory row, favorites, competition links.';

revoke all on function public.admin_apply_pub_canonical_on_scores(text, text, text, text) from public;
revoke all on function public.admin_merge_pub_into_target(text, text) from public;

grant execute on function public.admin_apply_pub_canonical_on_scores(text, text, text, text)
  to authenticated;
grant execute on function public.admin_merge_pub_into_target(text, text) to authenticated;
