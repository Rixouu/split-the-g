-- Link pours to a Google Place for Place Details (e.g. opening hours on pub pages).

alter table public.scores
  add column if not exists google_place_id text;

comment on column public.scores.google_place_id is
  'Google Place ID when the pourer chose a Places suggestion; powers pub detail opening hours.';

-- Optional override / manual link when scores lack a place id.
alter table public.pub_place_details
  add column if not exists google_place_id text;

comment on column public.pub_place_details.google_place_id is
  'Optional Google Place ID for this bar (admin); used if no place id on community scores.';

-- Append google_place_id last so column order matches the previous view; Postgres
-- matches CREATE OR REPLACE VIEW columns by position (otherwise it errors 42P16).
create or replace view public.bar_pub_stats as
select
  lower(trim(bar_name)) as bar_key,
  max(bar_name) as display_name,
  max(bar_address) filter (
    where bar_address is not null and trim(bar_address) <> ''
  ) as sample_address,
  round(avg(pour_rating)::numeric, 2) as avg_pour_rating,
  count(*) filter (where pour_rating is not null)::bigint as rating_count,
  count(*)::bigint as submission_count,
  max(google_place_id) filter (
    where google_place_id is not null and trim(google_place_id) <> ''
  ) as google_place_id
from public.scores
where bar_name is not null and trim(bar_name) <> ''
group by lower(trim(bar_name));

grant select on public.bar_pub_stats to anon, authenticated;
