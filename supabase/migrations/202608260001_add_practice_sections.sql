alter table public.reading_progress
  add column if not exists current_section text not null default 'main';

alter table public.practice_completions
  add column if not exists section_key text not null default 'main';

alter table public.reading_progress
  drop constraint if exists reading_progress_current_section_check;

alter table public.reading_progress
  add constraint reading_progress_current_section_check
  check (current_section in ('opening', 'main', 'mantra', 'closing'));

alter table public.practice_completions
  drop constraint if exists practice_completions_section_key_check;

alter table public.practice_completions
  add constraint practice_completions_section_key_check
  check (section_key in ('opening', 'main', 'mantra', 'closing'));

create index if not exists practice_completions_user_section_completed_at_idx
  on public.practice_completions (user_id, section_key, completed_at desc);
