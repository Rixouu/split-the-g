-- Pretty URL segment for /competitions/:segment (slug + short id suffix).

create or replace function public.competition_path_segment(p_title text, p_id uuid)
returns text
language plpgsql
immutable
as $$
declare
  slug text;
  short_id text;
begin
  slug := lower(regexp_replace(coalesce(trim(p_title), ''), '[^a-zA-Z0-9]+', '-', 'g'));
  slug := trim(both '-' from slug);
  if slug is null or slug = '' then
    slug := 'competition';
  end if;
  if length(slug) > 48 then
    slug := left(slug, 48);
  end if;
  short_id := lower(left(replace(p_id::text, '-', ''), 8));
  return slug || '-' || short_id;
end;
$$;

alter table public.competitions
  add column if not exists path_segment text;

update public.competitions c
set path_segment = public.competition_path_segment(c.title, c.id)
where c.path_segment is null;

alter table public.competitions
  alter column path_segment set not null;

create unique index if not exists competitions_path_segment_lower_key
  on public.competitions (lower(path_segment));

create or replace function public.competitions_set_path_segment()
returns trigger
language plpgsql
as $fn$
begin
  new.path_segment := public.competition_path_segment(new.title, new.id);
  return new;
end;
$fn$;

drop trigger if exists competitions_path_segment_tg on public.competitions;
create trigger competitions_path_segment_tg
  before insert or update of title on public.competitions
  for each row
  execute procedure public.competitions_set_path_segment();

comment on column public.competitions.path_segment is
  'Stable share segment: slugified title + first 8 hex chars of id (for /competitions/:segment).';
