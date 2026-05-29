-- Flash Learn — deck favorites
-- A user can favorite any deck they are allowed to read (their own or a
-- public one). Favorites are listed with the owner's current display name,
-- resolved through SECURITY DEFINER RPCs (profiles RLS hides other users).

create table if not exists public.deck_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, deck_id)
);

create index if not exists deck_favorites_user_created_idx
  on public.deck_favorites (user_id, created_at desc);

alter table public.deck_favorites enable row level security;

-- A user only ever sees and manages their own favorites, and may only favorite
-- a deck that is public or that they own (prevents favoriting a private deck
-- by guessing its id, which the SECURITY DEFINER reader would otherwise leak).
drop policy if exists "deck_favorites select own" on public.deck_favorites;
create policy "deck_favorites select own" on public.deck_favorites
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "deck_favorites insert own" on public.deck_favorites;
create policy "deck_favorites insert own" on public.deck_favorites
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.decks d
      where d.id = deck_id and (d.is_public or d.owner_id = auth.uid())
    )
  );

drop policy if exists "deck_favorites delete own" on public.deck_favorites;
create policy "deck_favorites delete own" on public.deck_favorites
  for delete to authenticated using (user_id = auth.uid());

-- Favorited decks for the current user, newest favorite first. Decks that
-- went private after being favorited (and aren't owned) are filtered out.
create or replace function public.get_favorite_decks()
 returns table(
   id uuid, owner_id uuid, owner_name text, title text, category text,
   tags text[], is_public boolean, card_count integer,
   created_at timestamp with time zone
 )
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    d.id,
    d.owner_id,
    p.display_name as owner_name,
    d.title,
    d.category,
    d.tags,
    d.is_public,
    d.card_count,
    d.created_at
  from public.deck_favorites f
  join public.decks d on d.id = f.deck_id
  left join public.profiles p on p.id = d.owner_id
  where f.user_id = auth.uid()
    and (d.is_public or d.owner_id = auth.uid())
  order by f.created_at desc;
$function$;

grant execute on function public.get_favorite_decks() to authenticated;

-- Single deck with the owner's current display name, readable when the deck is
-- public or owned by the caller. Used by the deck detail page to show the
-- author of a public deck (decks.* alone can't resolve another user's name).
create or replace function public.get_deck_detail(p_deck_id uuid)
 returns table(
   id uuid, owner_id uuid, owner_name text, title text, category text,
   tags text[], is_public boolean, card_count integer,
   created_at timestamp with time zone
 )
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    d.id,
    d.owner_id,
    p.display_name as owner_name,
    d.title,
    d.category,
    d.tags,
    d.is_public,
    d.card_count,
    d.created_at
  from public.decks d
  left join public.profiles p on p.id = d.owner_id
  where d.id = p_deck_id
    and (d.is_public or d.owner_id = auth.uid());
$function$;

grant execute on function public.get_deck_detail(uuid) to authenticated;
