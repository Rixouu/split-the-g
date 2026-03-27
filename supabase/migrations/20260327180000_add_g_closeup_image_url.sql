alter table public.scores
  add column if not exists g_closeup_image_url text;

comment on column public.scores.g_closeup_image_url is 'Tight crop around detected G logo on raw pour photo';
