create table if not exists public.reading_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_page integer not null default 1 check (current_page >= 1),
  cycle_started_at timestamptz not null default now(),
  current_cycle_completed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.practice_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cycle_started_at timestamptz not null,
  completed_page integer not null check (completed_page >= 1),
  completed_at timestamptz not null default now(),
  unique (user_id, cycle_started_at)
);

alter table public.reading_progress enable row level security;
alter table public.practice_completions enable row level security;

create policy "Users can read their own progress"
  on public.reading_progress
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own progress"
  on public.reading_progress
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own progress"
  on public.reading_progress
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read their own completions"
  on public.practice_completions
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own completions"
  on public.practice_completions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create index if not exists practice_completions_user_completed_at_idx
  on public.practice_completions (user_id, completed_at desc);
