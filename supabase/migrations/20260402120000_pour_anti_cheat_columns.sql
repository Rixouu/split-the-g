-- Anti-cheat / abuse prevention for pour submissions (see app/utils/pour-submission-guards.server.ts)

alter table public.scores
  add column if not exists source_image_sha256 text;

alter table public.scores
  add column if not exists ingest_ip text;

alter table public.scores
  add column if not exists submitter_user_id uuid;

comment on column public.scores.source_image_sha256 is
  'SHA-256 of raw pour image bytes; used to block duplicate uploads across accounts.';
comment on column public.scores.ingest_ip is
  'Client IP at ingest time for server-side rate limiting (not shown in product UI).';
comment on column public.scores.submitter_user_id is
  'Optional auth user id from client when submitting (friend/comp flow); used for rate limits.';

create unique index if not exists scores_source_image_sha256_unique
  on public.scores (source_image_sha256)
  where source_image_sha256 is not null and btrim(source_image_sha256) <> '';

create index if not exists scores_ingest_ip_created_idx
  on public.scores (ingest_ip, created_at desc)
  where ingest_ip is not null and btrim(ingest_ip) <> '';

create index if not exists scores_submitter_user_created_idx
  on public.scores (submitter_user_id, created_at desc)
  where submitter_user_id is not null;
