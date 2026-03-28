-- Optional pint price for expense tracking (user enters amount in their local currency).
alter table public.scores
  add column if not exists pint_price numeric(12, 2);

comment on column public.scores.pint_price is
  'Optional price paid for the pint; currency is implicit (user locale).';
