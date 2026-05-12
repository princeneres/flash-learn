-- Flash Learn initial schema
-- Apply via Supabase Dashboard SQL Editor or `supabase db push`.

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  photo_url text,
  provider text,
  points int not null default 0,
  total_reviews int not null default 0,
  streak int not null default 0,
  last_study_date date,
  language text not null default 'en',
  sound_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_name text,
  title text not null,
  category text,
  tags text[] not null default '{}',
  is_public boolean not null default false,
  card_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists decks_owner_created_idx
  on public.decks (owner_id, created_at desc);
create index if not exists decks_public_created_idx
  on public.decks (is_public, created_at desc) where is_public;

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  front text not null,
  back text not null,
  front_audio text,
  back_audio text,
  next_review timestamptz not null default now(),
  interval int not null default 0,
  ease_factor numeric not null default 2.5,
  repetitions int not null default 0,
  status text not null default 'new',
  created_at timestamptz not null default now()
);
create index if not exists cards_deck_idx on public.cards (deck_id);
create index if not exists cards_owner_next_idx on public.cards (owner_id, next_review);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  unlocked_at timestamptz not null default now(),
  unique (owner_id, key)
);

-- ============================================================
-- Triggers
-- ============================================================

create or replace function public.bump_card_count() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.decks set card_count = card_count + 1 where id = new.deck_id;
  elsif tg_op = 'DELETE' then
    update public.decks set card_count = greatest(card_count - 1, 0) where id = old.deck_id;
  end if;
  return null;
end $$;

drop trigger if exists cards_count_trigger on public.cards;
create trigger cards_count_trigger
  after insert or delete on public.cards
  for each row execute function public.bump_card_count();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, photo_url, provider)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'user_name'
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(new.raw_app_meta_data ->> 'provider', 'email')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles     enable row level security;
alter table public.decks        enable row level security;
alter table public.cards        enable row level security;
alter table public.achievements enable row level security;

drop policy if exists "profiles self read"  on public.profiles;
drop policy if exists "profiles self write" on public.profiles;
create policy "profiles self read"  on public.profiles for select using (auth.uid() = id);
create policy "profiles self write" on public.profiles for update using (auth.uid() = id);

drop policy if exists "decks read own or public" on public.decks;
drop policy if exists "decks write own"          on public.decks;
create policy "decks read own or public" on public.decks for select
  using (auth.uid() = owner_id or is_public);
create policy "decks write own" on public.decks for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "cards read own or public deck" on public.cards;
drop policy if exists "cards write own"               on public.cards;
create policy "cards read own or public deck" on public.cards for select
  using (
    auth.uid() = owner_id
    or exists (select 1 from public.decks d where d.id = cards.deck_id and d.is_public)
  );
create policy "cards write own" on public.cards for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "achievements self" on public.achievements;
create policy "achievements self" on public.achievements for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ============================================================
-- Storage policy (create bucket "media" as private via dashboard first)
-- ============================================================

drop policy if exists "media own folder" on storage.objects;
create policy "media own folder" on storage.objects for all
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
