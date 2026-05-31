-- Flash Learn — collections (an optional grouping scope above decks).
-- A collection groups study material around one macro topic (e.g. "16 rules
-- of English", with one deck per rule). The link is OPTIONAL: a deck need not
-- belong to any collection, and a deck may belong to MORE THAN ONE collection
-- (M:N through deck_collections). Decks with no collection behave exactly as
-- before. Collections can also hold other study modes (see quizzes migration).

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_name text,
  title text not null,
  description text,
  category text,
  tags text[] not null default '{}',
  is_public boolean not null default false,
  cover_color text,
  deck_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists collections_owner_created_idx
  on public.collections (owner_id, created_at desc);
create index if not exists collections_public_created_idx
  on public.collections (is_public, created_at desc) where is_public;

-- M:N link between collections and decks, with an explicit order so the decks
-- inside a collection can be sequenced (rule 1, rule 2, ...).
create table if not exists public.deck_collections (
  collection_id uuid not null references public.collections(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  primary key (collection_id, deck_id)
);
create index if not exists deck_collections_collection_idx
  on public.deck_collections (collection_id, order_index);
create index if not exists deck_collections_deck_idx
  on public.deck_collections (deck_id);

-- ============================================================
-- Triggers — keep collections.deck_count denormalized
-- ============================================================

create or replace function public.bump_deck_count() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.collections set deck_count = deck_count + 1 where id = new.collection_id;
  elsif tg_op = 'DELETE' then
    update public.collections set deck_count = greatest(deck_count - 1, 0) where id = old.collection_id;
  end if;
  return null;
end $$;

drop trigger if exists deck_collections_count_trigger on public.deck_collections;
create trigger deck_collections_count_trigger
  after insert or delete on public.deck_collections
  for each row execute function public.bump_deck_count();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.collections      enable row level security;
alter table public.deck_collections enable row level security;

drop policy if exists "collections read own or public" on public.collections;
drop policy if exists "collections write own"          on public.collections;
create policy "collections read own or public" on public.collections for select
  using (auth.uid() = owner_id or is_public);
create policy "collections write own" on public.collections for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- A membership row is readable if the collection is readable (own or public);
-- only the owner of both sides may create/delete links.
drop policy if exists "deck_collections read" on public.deck_collections;
create policy "deck_collections read" on public.deck_collections for select
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and (c.is_public or c.owner_id = auth.uid())
    )
  );

drop policy if exists "deck_collections write own" on public.deck_collections;
create policy "deck_collections write own" on public.deck_collections for all
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid())
    and exists (select 1 from public.decks d where d.id = deck_id and d.owner_id = auth.uid())
  );

-- ============================================================
-- Read RPCs — resolve the owner's current display name (profiles RLS hides
-- other users), mirroring get_public_decks / get_deck_detail.
-- ============================================================

create or replace function public.get_public_collections()
 returns table(
   id uuid, owner_id uuid, owner_name text, title text, description text,
   category text, tags text[], is_public boolean, cover_color text,
   deck_count integer, created_at timestamp with time zone
 )
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    c.id, c.owner_id, p.display_name as owner_name, c.title, c.description,
    c.category, c.tags, c.is_public, c.cover_color, c.deck_count, c.created_at
  from public.collections c
  left join public.profiles p on p.id = c.owner_id
  where c.is_public
  order by c.created_at desc;
$function$;

grant execute on function public.get_public_collections() to authenticated;

create or replace function public.get_collection_detail(p_collection_id uuid)
 returns table(
   id uuid, owner_id uuid, owner_name text, title text, description text,
   category text, tags text[], is_public boolean, cover_color text,
   deck_count integer, created_at timestamp with time zone
 )
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    c.id, c.owner_id, p.display_name as owner_name, c.title, c.description,
    c.category, c.tags, c.is_public, c.cover_color, c.deck_count, c.created_at
  from public.collections c
  left join public.profiles p on p.id = c.owner_id
  where c.id = p_collection_id
    and (c.is_public or c.owner_id = auth.uid());
$function$;

grant execute on function public.get_collection_detail(uuid) to authenticated;

-- Decks belonging to a collection, in the collection's defined order. Readable
-- when the collection is public or owned by the caller; resolves owner names so
-- a public collection's decks render for non-owners.
create or replace function public.get_collection_decks(p_collection_id uuid)
 returns table(
   id uuid, owner_id uuid, owner_name text, title text, category text,
   tags text[], is_public boolean, card_count integer,
   created_at timestamp with time zone, srs_settings jsonb, order_index integer
 )
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    d.id, d.owner_id, p.display_name as owner_name, d.title, d.category,
    d.tags, d.is_public, d.card_count, d.created_at, d.srs_settings, dc.order_index
  from public.deck_collections dc
  join public.collections c on c.id = dc.collection_id
  join public.decks d on d.id = dc.deck_id
  left join public.profiles p on p.id = d.owner_id
  where dc.collection_id = p_collection_id
    and (c.is_public or c.owner_id = auth.uid())
  order by dc.order_index, d.created_at;
$function$;

grant execute on function public.get_collection_decks(uuid) to authenticated;
