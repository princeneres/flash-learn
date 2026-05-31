-- Feature suggestions submitted by users from inside the app.
-- Rows are written by the `feature-suggestion` edge function (service role),
-- which derives the user identity from the verified JWT. RLS policies below
-- also allow a user to read/insert their own rows directly if ever needed.

create table if not exists public.feature_suggestions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  category    text not null default 'general',
  message     text not null,
  context     jsonb not null default '{}'::jsonb,
  status      text not null default 'new',
  created_at  timestamptz not null default now()
);

create index if not exists feature_suggestions_user_id_idx
  on public.feature_suggestions (user_id);
create index if not exists feature_suggestions_created_at_idx
  on public.feature_suggestions (created_at desc);

alter table public.feature_suggestions enable row level security;

drop policy if exists "feature_suggestions insert own" on public.feature_suggestions;
drop policy if exists "feature_suggestions read own"   on public.feature_suggestions;

create policy "feature_suggestions insert own" on public.feature_suggestions
  for insert with check (auth.uid() = user_id);

create policy "feature_suggestions read own" on public.feature_suggestions
  for select using (auth.uid() = user_id);
