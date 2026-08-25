do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'practice_completions'
      and policyname = 'Users can delete their own completions'
  ) then
    create policy "Users can delete their own completions"
      on public.practice_completions
      for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;
