-- Short public slug for pretty URLs (/pour/{slug}). Legacy /score/{uuid} redirects via app route.

alter table public.scores add column if not exists slug text;

create unique index if not exists scores_slug_unique
  on public.scores (slug)
  where slug is not null and trim(slug) <> '';
