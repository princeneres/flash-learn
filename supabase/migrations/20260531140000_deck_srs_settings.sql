-- Per-deck spaced-repetition settings (Anki-style "Deck Options").
-- Stored as JSONB so the shape can evolve without further migrations; the app
-- merges it with defaults, so an empty/partial object is always safe.
alter table public.decks
  add column if not exists srs_settings jsonb not null default '{}'::jsonb;

-- Surface srs_settings through the read RPCs so the study session and the deck
-- editor (which fetch via get_deck_detail / get_public_decks) receive it too.
-- Adding a column to RETURNS TABLE changes the return type, which CREATE OR
-- REPLACE cannot do, so the existing functions must be dropped first.
drop function if exists public.get_deck_detail(uuid);
create or replace function public.get_deck_detail(p_deck_id uuid)
 returns table(
   id uuid, owner_id uuid, owner_name text, title text, category text,
   tags text[], is_public boolean, card_count integer,
   created_at timestamp with time zone, srs_settings jsonb
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
    d.created_at,
    d.srs_settings
  from public.decks d
  left join public.profiles p on p.id = d.owner_id
  where d.id = p_deck_id
    and (d.is_public or d.owner_id = auth.uid());
$function$;

grant execute on function public.get_deck_detail(uuid) to authenticated;

drop function if exists public.get_public_decks();
create or replace function public.get_public_decks()
 returns table(
   id uuid, owner_id uuid, owner_name text, title text, category text,
   tags text[], is_public boolean, card_count integer,
   created_at timestamp with time zone, srs_settings jsonb
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
    d.created_at,
    d.srs_settings
  from public.decks d
  left join public.profiles p on p.id = d.owner_id
  where d.is_public
  order by d.created_at desc;
$function$;

grant execute on function public.get_public_decks() to authenticated;
