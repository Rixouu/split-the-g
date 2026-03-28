-- Optional venue / address shown on competition detail.

alter table public.competitions
  add column if not exists location_name text,
  add column if not exists location_address text;

comment on column public.competitions.location_name is
  'Optional venue or area label for the competition.';
comment on column public.competitions.location_address is
  'Optional address or extra location detail.';
