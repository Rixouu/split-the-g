-- Additional win rules + align glasses_per_person for most_submissions with app sentinel.

alter table public.competitions drop constraint if exists competitions_win_rule_check;

alter table public.competitions add constraint competitions_win_rule_check check (
  win_rule in (
    'highest_score',
    'lowest_score',
    'best_average',
    'closest_to_target',
    'most_submissions'
  )
);

update public.competitions
set glasses_per_person = 9999
where win_rule = 'most_submissions'
  and glasses_per_person < 9999;
