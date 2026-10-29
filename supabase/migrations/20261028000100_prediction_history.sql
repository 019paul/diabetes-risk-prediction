create table public.prediction_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  predicted_class text not null check (
    predicted_class in (
      'No self-reported previous diabetes diagnosis',
      'Yes, self-reported previous diabetes diagnosis'
    )
  ),
  probability numeric(8, 7) check (probability between 0 and 1),
  model_version text not null
);

alter table public.prediction_history enable row level security;
alter table public.prediction_history force row level security;

create policy "Users can read only their own prediction history"
  on public.prediction_history
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add only their own prediction history"
  on public.prediction_history
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on table public.prediction_history from public, anon, authenticated;
grant select, insert on public.prediction_history to authenticated;