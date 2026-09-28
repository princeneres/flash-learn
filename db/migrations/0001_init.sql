-- Flash Learn — initial Neon schema.
--
-- Consolidated final state of the former Supabase migrations (supabase/migrations/),
-- adapted to Neon:
--   * users live in neon_auth."user" (Neon Auth / Better Auth) instead of auth.users;
--   * auth.uid() is provided by pg_session_jwt (Data API JWT), so RLS policies are unchanged;
--   * Data API roles are `authenticated` / `anonymous` (no `anon` / `service_role`);
--   * server code (api/*) connects as the database owner, which bypasses RLS;
--   * storage.objects policies are gone — media access is enforced by the API layer.

-- ============================================================
-- Core tables
-- ============================================================

create table public.profiles (
  id uuid primary key references neon_auth."user"(id) on delete cascade,
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

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references neon_auth."user"(id) on delete cascade,
  title text not null,
  category text,
  tags text[] not null default '{}',
  is_public boolean not null default false,
  card_count int not null default 0,
  -- Per-deck spaced-repetition settings; the app merges with defaults.
  srs_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index decks_owner_created_idx on public.decks (owner_id, created_at desc);
create index decks_public_created_idx on public.decks (is_public, created_at desc) where is_public;

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  owner_id uuid not null references neon_auth."user"(id) on delete cascade,
  front text not null,
  back text not null,
  front_audio text,
  back_audio text,
  next_review timestamptz not null default now(),
  interval int not null default 0,
  ease_factor numeric not null default 2.5,
  repetitions int not null default 0,
  status text not null default 'new',
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index cards_deck_idx on public.cards (deck_id);
create index cards_owner_next_idx on public.cards (owner_id, next_review);
create index cards_tags_idx on public.cards using gin (tags);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references neon_auth."user"(id) on delete cascade,
  key text not null,
  unlocked_at timestamptz not null default now(),
  unique (owner_id, key)
);

create table public.card_media (
  card_id uuid not null references public.cards(id) on delete cascade,
  owner_id uuid not null references neon_auth."user"(id) on delete cascade,
  ref text not null,
  kind text not null check (kind in ('audio', 'image')),
  primary key (card_id, ref, kind)
);
create index card_media_owner_ref_idx on public.card_media (owner_id, ref);

create table public.review_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references neon_auth."user"(id) on delete cascade,
  card_id uuid references public.cards(id) on delete set null,
  deck_id uuid references public.decks(id) on delete set null,
  deck_category text,
  quality smallint not null check (quality >= 0 and quality <= 5),
  was_correct boolean not null,
  prev_status text,
  reviewed_at timestamptz not null default now()
);
create index review_logs_owner_category_idx on public.review_logs (owner_id, deck_category);
create index review_logs_owner_time_idx on public.review_logs (owner_id, reviewed_at desc);

create table public.deck_favorites (
  user_id uuid not null references neon_auth."user"(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, deck_id)
);
create index deck_favorites_user_created_idx on public.deck_favorites (user_id, created_at desc);

create table public.feature_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references neon_auth."user"(id) on delete cascade,
  category text not null default 'general',
  message text not null,
  context jsonb not null default '{}'::jsonb,
  status text not null default 'new',
  created_at timestamptz not null default now()
);
create index feature_suggestions_user_id_idx on public.feature_suggestions (user_id);
create index feature_suggestions_created_at_idx on public.feature_suggestions (created_at desc);

-- ============================================================
-- Plans, subscriptions & AI credits
-- ============================================================

create table public.plans (
  id text primary key,
  name text not null,
  max_decks int not null,
  max_total_cards int not null,
  max_cards_per_deck int not null,
  max_media_bytes bigint not null,
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.user_plans (
  user_id uuid primary key references neon_auth."user"(id) on delete cascade,
  plan_id text not null references public.plans(id),
  activated_at timestamptz not null default now(),
  expires_at timestamptz
);

create table public.subscriptions (
  user_id uuid primary key references neon_auth."user"(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled')),
  abacate_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index subscriptions_abacate_id_idx
  on public.subscriptions (abacate_subscription_id)
  where abacate_subscription_id is not null;

create table public.ai_credits (
  user_id uuid primary key references neon_auth."user"(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

-- `abacate_id` is unique so a replayed `billing.paid` webhook never credits twice.
create table public.ai_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references neon_auth."user"(id) on delete cascade,
  delta integer not null,
  reason text not null, -- 'purchase' | 'generation' | 'refund' | 'courtesy'
  abacate_id text unique,
  created_at timestamptz not null default now()
);
create index ai_credit_ledger_user_idx on public.ai_credit_ledger (user_id, created_at desc);

create table public.ai_credit_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references neon_auth."user"(id) on delete cascade,
  pack_id text not null,
  credits integer not null,
  amount_cents integer not null,
  status text not null default 'pending', -- pending | paid | expired
  abacate_id text,
  created_at timestamptz not null default now()
);
create index ai_credit_orders_user_idx on public.ai_credit_orders (user_id, created_at desc);

-- ============================================================
-- Collections & quizzes
-- ============================================================

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references neon_auth."user"(id) on delete cascade,
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
create index collections_owner_created_idx on public.collections (owner_id, created_at desc);
create index collections_public_created_idx on public.collections (is_public, created_at desc) where is_public;

create table public.deck_collections (
  collection_id uuid not null references public.collections(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  owner_id uuid not null references neon_auth."user"(id) on delete cascade,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  primary key (collection_id, deck_id)
);
create index deck_collections_collection_idx on public.deck_collections (collection_id, order_index);
create index deck_collections_deck_idx on public.deck_collections (deck_id);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references neon_auth."user"(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  title text not null,
  description text,
  question_count int not null default 0,
  pass_threshold int, -- % correct needed to pass; null = no gate
  order_index int not null default 0,
  created_at timestamptz not null default now()
);
create index quizzes_collection_idx on public.quizzes (collection_id, order_index);
create index quizzes_owner_idx on public.quizzes (owner_id);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  owner_id uuid not null references neon_auth."user"(id) on delete cascade,
  prompt text not null,
  kind text not null default 'single', -- 'single' | 'multiple' | 'boolean'
  options jsonb not null default '[]'::jsonb, -- [{ "id": "a", "text": "...", "correct": true }]
  explanation text,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);
create index quiz_questions_quiz_idx on public.quiz_questions (quiz_id, order_index);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references neon_auth."user"(id) on delete cascade,
  quiz_id uuid references public.quizzes(id) on delete set null,
  collection_id uuid references public.collections(id) on delete set null,
  score int not null default 0,
  total int not null default 0,
  answers jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null default now()
);
create index quiz_attempts_owner_idx on public.quiz_attempts (owner_id, completed_at desc);
create index quiz_attempts_quiz_idx on public.quiz_attempts (quiz_id);

-- ============================================================
-- Seed plans
-- ============================================================

insert into public.plans (id, name, max_decks, max_total_cards, max_cards_per_deck, max_media_bytes, features)
values
  ('free', 'Free', 10, 1000, 100, 104857600, '{}'::jsonb),
  ('pro', 'Pro', 1000, 1000000, 10000, 5368709120,
   '{"advancedStats": true, "export": true, "media": true, "monthlyCredits": 30}'::jsonb);

-- ============================================================
-- Counter / media / quota triggers
-- ============================================================

create function public.bump_card_count() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.decks set card_count = card_count + 1 where id = new.deck_id;
  elsif tg_op = 'DELETE' then
    update public.decks set card_count = greatest(card_count - 1, 0) where id = old.deck_id;
  end if;
  return null;
end $$;

create trigger cards_count_trigger
  after insert or delete on public.cards
  for each row execute function public.bump_card_count();

create function public.bump_deck_count() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.collections set deck_count = deck_count + 1 where id = new.collection_id;
  elsif tg_op = 'DELETE' then
    update public.collections set deck_count = greatest(deck_count - 1, 0) where id = old.collection_id;
  end if;
  return null;
end $$;

create trigger deck_collections_count_trigger
  after insert or delete on public.deck_collections
  for each row execute function public.bump_deck_count();

create function public.bump_question_count() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.quizzes set question_count = question_count + 1 where id = new.quiz_id;
  elsif tg_op = 'DELETE' then
    update public.quizzes set question_count = greatest(question_count - 1, 0) where id = old.quiz_id;
  end if;
  return null;
end $$;

create trigger quiz_questions_count_trigger
  after insert or delete on public.quiz_questions
  for each row execute function public.bump_question_count();

create function public.sync_card_media() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  combined text;
  ref text;
begin
  delete from public.card_media where card_id = new.id;
  combined := coalesce(new.front, '') || ' ' || coalesce(new.back, '');
  for ref in
    select m[1]
    from regexp_matches(combined, 'media://([^"''<>\s)]+)', 'g') as t(m)
  loop
    insert into public.card_media (card_id, owner_id, ref, kind)
    values (
      new.id, new.owner_id, ref,
      case when ref ~* '\.(mp3|ogg|wav|m4a|webm|aac|opus|flac)$'
           then 'audio' else 'image' end
    )
    on conflict do nothing;
  end loop;
  if coalesce(new.front_audio, '') != '' then
    insert into public.card_media (card_id, owner_id, ref, kind)
    values (new.id, new.owner_id, new.front_audio, 'audio')
    on conflict do nothing;
  end if;
  if coalesce(new.back_audio, '') != '' then
    insert into public.card_media (card_id, owner_id, ref, kind)
    values (new.id, new.owner_id, new.back_audio, 'audio')
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger cards_media_sync
  after insert or update of front, back, front_audio, back_audio on public.cards
  for each row execute function public.sync_card_media();

-- Falls back to 'free' when the user has no (or an expired) assignment.
create function public.get_user_plan(uid uuid) returns public.plans
language sql stable security definer set search_path to 'public' as $$
  select p.* from public.plans p
  where p.id = coalesce(
    (
      select up.plan_id from public.user_plans up
      where up.user_id = uid
        and (up.expires_at is null or up.expires_at > now())
      limit 1
    ),
    'free'
  )
  limit 1;
$$;

create function public.enforce_deck_quota() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  plan public.plans;
  cur_count int;
begin
  plan := public.get_user_plan(new.owner_id);
  if plan is null then
    raise exception '%', json_build_object('code', 'PLAN_NOT_FOUND')::text
      using errcode = 'P0001';
  end if;
  select count(*) into cur_count from public.decks where owner_id = new.owner_id;
  if cur_count >= plan.max_decks then
    raise exception '%', json_build_object(
      'code', 'DECK_LIMIT_REACHED',
      'limit', plan.max_decks,
      'current', cur_count,
      'plan', plan.id
    )::text using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger decks_quota_trigger
  before insert on public.decks
  for each row execute function public.enforce_deck_quota();

create function public.enforce_card_quota() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  plan public.plans;
  total_cards int;
  deck_cards int;
begin
  plan := public.get_user_plan(new.owner_id);
  if plan is null then
    raise exception '%', json_build_object('code', 'PLAN_NOT_FOUND')::text
      using errcode = 'P0001';
  end if;
  select count(*) into total_cards from public.cards where owner_id = new.owner_id;
  if total_cards >= plan.max_total_cards then
    raise exception '%', json_build_object(
      'code', 'TOTAL_CARD_LIMIT_REACHED',
      'limit', plan.max_total_cards,
      'current', total_cards,
      'plan', plan.id
    )::text using errcode = 'P0001';
  end if;
  select coalesce(card_count, 0) into deck_cards from public.decks where id = new.deck_id;
  if deck_cards >= plan.max_cards_per_deck then
    raise exception '%', json_build_object(
      'code', 'DECK_CARD_LIMIT_REACHED',
      'limit', plan.max_cards_per_deck,
      'current', deck_cards,
      'plan', plan.id
    )::text using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger cards_quota_trigger
  before insert on public.cards
  for each row execute function public.enforce_card_quota();

-- Stats columns may only change inside record_review.
create function public.protect_profile_stats() returns trigger
language plpgsql as $$
begin
  if current_setting('app.allow_stats_write', true) is distinct from 'on' then
    new.points          := old.points;
    new.total_reviews   := old.total_reviews;
    new.streak          := old.streak;
    new.last_study_date := old.last_study_date;
  end if;
  return new;
end $$;

create trigger profiles_protect_stats
  before update on public.profiles
  for each row execute function public.protect_profile_stats();

-- ============================================================
-- Neon Auth hooks
-- ============================================================

-- New user → profile + courtesy AI credits. Better Auth creates the user row
-- first and the account row (which carries the provider) right after.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.profiles (id, email, display_name, photo_url, provider)
  values (new.id, new.email, new.name, new.image, 'email')
  on conflict (id) do nothing;

  insert into public.ai_credits (user_id, balance)
  values (new.id, 3)
  on conflict (user_id) do nothing;

  insert into public.ai_credit_ledger (user_id, delta, reason, abacate_id)
  values (new.id, 3, 'courtesy', 'courtesy:' || new.id)
  on conflict (abacate_id) do nothing;

  return new;
end $$;

create trigger on_neon_auth_user_created
  after insert on neon_auth."user"
  for each row execute function public.handle_new_user();

-- Records the OAuth provider ('google', 'github') on the profile; email/password
-- accounts use providerId 'credential' and keep the default 'email'.
create function public.handle_new_account() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new."providerId" <> 'credential' then
    update public.profiles set provider = new."providerId" where id = new."userId";
  end if;
  return new;
end $$;

create trigger on_neon_auth_account_created
  after insert on neon_auth.account
  for each row execute function public.handle_new_account();

-- Keeps name/avatar in sync when the user edits them through Neon Auth.
create function public.handle_user_updated() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  update public.profiles
     set display_name = new.name, photo_url = new.image, email = new.email
   where id = new.id;
  return new;
end $$;

create trigger on_neon_auth_user_updated
  after update of name, image, email on neon_auth."user"
  for each row execute function public.handle_user_updated();

-- ============================================================
-- RPCs (exposed through the Data API)
-- ============================================================

create function public.record_review(p_card_id uuid, p_quality integer) returns json
language plpgsql security definer set search_path to 'public' as $$
declare
  uid uuid := auth.uid();
  card_owner uuid;
  pts int;
  today date := current_date;
  prev_streak int;
  prev_date date;
  new_streak int;
  new_points int;
  new_total int;
  unlocked_key text := null;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_quality < 0 or p_quality > 5 then
    raise exception 'INVALID_QUALITY' using errcode = 'P0001';
  end if;

  select owner_id into card_owner from public.cards where id = p_card_id;
  if card_owner is null or card_owner <> uid then
    raise exception 'CARD_NOT_FOUND' using errcode = 'P0001';
  end if;

  pts := case when p_quality >= 3 then 10 else 1 end;

  select streak, last_study_date into prev_streak, prev_date
    from public.profiles where id = uid for update;

  if prev_date = today then
    new_streak := coalesce(prev_streak, 0);
  elsif prev_date = today - 1 then
    new_streak := coalesce(prev_streak, 0) + 1;
  else
    new_streak := 1;
  end if;

  perform set_config('app.allow_stats_write', 'on', true);

  update public.profiles
    set points = points + pts,
        total_reviews = total_reviews + 1,
        streak = new_streak,
        last_study_date = today
    where id = uid
    returning points, total_reviews into new_points, new_total;

  if new_total = 10 then
    unlocked_key := 'first_10_reviews';
  elsif new_total = 100 then
    unlocked_key := '100_reviews';
  end if;

  if unlocked_key is not null then
    insert into public.achievements (owner_id, key)
    values (uid, unlocked_key)
    on conflict (owner_id, key) do nothing;
    if not found then
      unlocked_key := null; -- already had it; not a fresh unlock
    end if;
  end if;

  return json_build_object(
    'points', new_points,
    'totalReviews', new_total,
    'streak', new_streak,
    'achievement', unlocked_key
  );
end $$;

create function public.get_leaderboard()
returns table(id uuid, display_name text, photo_url text, points integer, total_reviews integer, streak integer)
language sql stable security definer set search_path to 'public' as $$
  select id, display_name, photo_url, points, total_reviews, streak
  from public.profiles
  order by points desc, total_reviews desc
  limit 50;
$$;

create function public.get_my_limits() returns json
language plpgsql stable security definer set search_path to 'public' as $$
declare
  uid uuid := auth.uid();
  plan public.plans;
  total_decks int;
  total_cards int;
begin
  if uid is null then return null; end if;
  plan := public.get_user_plan(uid);
  if plan is null then return null; end if;
  select count(*) into total_decks from public.decks where owner_id = uid;
  select count(*) into total_cards from public.cards where owner_id = uid;
  return json_build_object(
    'plan', json_build_object(
      'id', plan.id,
      'name', plan.name,
      'maxDecks', plan.max_decks,
      'maxTotalCards', plan.max_total_cards,
      'maxCardsPerDeck', plan.max_cards_per_deck,
      'maxMediaBytes', plan.max_media_bytes,
      'features', plan.features
    ),
    'usage', json_build_object(
      'decks', total_decks,
      'totalCards', total_cards
    )
  );
end $$;

create function public.get_public_decks()
returns table(
  id uuid, owner_id uuid, owner_name text, title text, category text,
  tags text[], is_public boolean, card_count integer,
  created_at timestamptz, srs_settings jsonb
)
language sql stable security definer set search_path to 'public' as $$
  select d.id, d.owner_id, p.display_name, d.title, d.category, d.tags,
         d.is_public, d.card_count, d.created_at, d.srs_settings
  from public.decks d
  left join public.profiles p on p.id = d.owner_id
  where d.is_public
  order by d.created_at desc;
$$;

create function public.get_deck_detail(p_deck_id uuid)
returns table(
  id uuid, owner_id uuid, owner_name text, title text, category text,
  tags text[], is_public boolean, card_count integer,
  created_at timestamptz, srs_settings jsonb
)
language sql stable security definer set search_path to 'public' as $$
  select d.id, d.owner_id, p.display_name, d.title, d.category, d.tags,
         d.is_public, d.card_count, d.created_at, d.srs_settings
  from public.decks d
  left join public.profiles p on p.id = d.owner_id
  where d.id = p_deck_id
    and (d.is_public or d.owner_id = auth.uid());
$$;

-- Decks that went private after being favorited (and aren't owned) are filtered out.
create function public.get_favorite_decks()
returns table(
  id uuid, owner_id uuid, owner_name text, title text, category text,
  tags text[], is_public boolean, card_count integer, created_at timestamptz
)
language sql stable security definer set search_path to 'public' as $$
  select d.id, d.owner_id, p.display_name, d.title, d.category, d.tags,
         d.is_public, d.card_count, d.created_at
  from public.deck_favorites f
  join public.decks d on d.id = f.deck_id
  left join public.profiles p on p.id = d.owner_id
  where f.user_id = auth.uid()
    and (d.is_public or d.owner_id = auth.uid())
  order by f.created_at desc;
$$;

create function public.get_public_collections()
returns table(
  id uuid, owner_id uuid, owner_name text, title text, description text,
  category text, tags text[], is_public boolean, cover_color text,
  deck_count integer, created_at timestamptz
)
language sql stable security definer set search_path to 'public' as $$
  select c.id, c.owner_id, p.display_name, c.title, c.description,
         c.category, c.tags, c.is_public, c.cover_color, c.deck_count, c.created_at
  from public.collections c
  left join public.profiles p on p.id = c.owner_id
  where c.is_public
  order by c.created_at desc;
$$;

create function public.get_collection_detail(p_collection_id uuid)
returns table(
  id uuid, owner_id uuid, owner_name text, title text, description text,
  category text, tags text[], is_public boolean, cover_color text,
  deck_count integer, created_at timestamptz
)
language sql stable security definer set search_path to 'public' as $$
  select c.id, c.owner_id, p.display_name, c.title, c.description,
         c.category, c.tags, c.is_public, c.cover_color, c.deck_count, c.created_at
  from public.collections c
  left join public.profiles p on p.id = c.owner_id
  where c.id = p_collection_id
    and (c.is_public or c.owner_id = auth.uid());
$$;

create function public.get_collection_decks(p_collection_id uuid)
returns table(
  id uuid, owner_id uuid, owner_name text, title text, category text,
  tags text[], is_public boolean, card_count integer,
  created_at timestamptz, srs_settings jsonb, order_index integer
)
language sql stable security definer set search_path to 'public' as $$
  select d.id, d.owner_id, p.display_name, d.title, d.category,
         d.tags, d.is_public, d.card_count, d.created_at, d.srs_settings, dc.order_index
  from public.deck_collections dc
  join public.collections c on c.id = dc.collection_id
  join public.decks d on d.id = dc.deck_id
  left join public.profiles p on p.id = d.owner_id
  where dc.collection_id = p_collection_id
    and (c.is_public or c.owner_id = auth.uid())
  order by dc.order_index, d.created_at;
$$;

create function public.get_collection_quizzes(p_collection_id uuid)
returns table(
  id uuid, owner_id uuid, collection_id uuid, title text, description text,
  question_count integer, pass_threshold integer, order_index integer,
  created_at timestamptz
)
language sql stable security definer set search_path to 'public' as $$
  select q.id, q.owner_id, q.collection_id, q.title, q.description,
         q.question_count, q.pass_threshold, q.order_index, q.created_at
  from public.quizzes q
  join public.collections c on c.id = q.collection_id
  where q.collection_id = p_collection_id
    and (c.is_public or c.owner_id = auth.uid())
  order by q.order_index, q.created_at;
$$;

create function public.get_ai_credits() returns integer
language sql stable security definer set search_path to 'public' as $$
  select coalesce((select balance from public.ai_credits where user_id = auth.uid()), 0);
$$;

-- ============================================================
-- Server-only functions (called by api/* as the database owner)
-- ============================================================

-- Atomically spend one credit; raises INSUFFICIENT_CREDITS at zero balance.
create function public.debit_ai_credit(p_user uuid) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare
  new_balance integer;
begin
  update public.ai_credits
     set balance = balance - 1, updated_at = now()
   where user_id = p_user and balance > 0
  returning balance into new_balance;

  if new_balance is null then
    raise exception 'INSUFFICIENT_CREDITS' using errcode = 'P0001';
  end if;

  insert into public.ai_credit_ledger (user_id, delta, reason)
  values (p_user, -1, 'generation');

  return new_balance;
end $$;

-- Idempotent on p_abacate_id — safe for webhook retries.
create function public.credit_ai(
  p_user uuid,
  p_amount integer,
  p_reason text,
  p_abacate_id text default null
) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare
  cur_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;

  if p_abacate_id is not null and exists (
    select 1 from public.ai_credit_ledger where abacate_id = p_abacate_id
  ) then
    select balance into cur_balance from public.ai_credits where user_id = p_user;
    return coalesce(cur_balance, 0);
  end if;

  insert into public.ai_credit_ledger (user_id, delta, reason, abacate_id)
  values (p_user, p_amount, p_reason, p_abacate_id);

  insert into public.ai_credits (user_id, balance)
  values (p_user, p_amount)
  on conflict (user_id) do update
    set balance = public.ai_credits.balance + excluded.balance,
        updated_at = now()
  returning balance into cur_balance;

  return cur_balance;
end $$;

create function public.apply_subscription(
  p_user uuid,
  p_plan text,
  p_status text,
  p_period_end timestamptz,
  p_abacate_id text
) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.subscriptions (user_id, plan_id, status, abacate_subscription_id, current_period_end, updated_at)
  values (p_user, p_plan, p_status, p_abacate_id, p_period_end, now())
  on conflict (user_id) do update
    set plan_id = excluded.plan_id,
        status = excluded.status,
        abacate_subscription_id = coalesce(excluded.abacate_subscription_id, subscriptions.abacate_subscription_id),
        current_period_end = excluded.current_period_end,
        updated_at = now();

  insert into public.user_plans (user_id, plan_id, activated_at, expires_at)
  values (p_user, p_plan, now(), p_period_end)
  on conflict (user_id) do update
    set plan_id = excluded.plan_id,
        activated_at = now(),
        expires_at = excluded.expires_at;
end $$;

-- Keeps access until current_period_end (user_plans.expires_at gates it).
create function public.cancel_subscription(p_user uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  update public.subscriptions set status = 'canceled', updated_at = now() where user_id = p_user;
end $$;

-- ============================================================
-- Grants
-- ============================================================

-- Functions default to EXECUTE for PUBLIC; only the client RPCs stay callable.
revoke execute on all functions in schema public from public, anonymous, authenticated;
grant execute on function
  public.record_review(uuid, integer),
  public.get_leaderboard(),
  public.get_my_limits(),
  public.get_public_decks(),
  public.get_deck_detail(uuid),
  public.get_favorite_decks(),
  public.get_public_collections(),
  public.get_collection_detail(uuid),
  public.get_collection_decks(uuid),
  public.get_collection_quizzes(uuid),
  public.get_ai_credits()
to authenticated;

-- Table privileges for `authenticated` come from the Data API default ACL;
-- RLS below decides which rows. `anonymous` may only read the plan catalog.
grant usage on schema public to anonymous;
grant select on public.plans to anonymous;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles            enable row level security;
alter table public.decks               enable row level security;
alter table public.cards               enable row level security;
alter table public.achievements        enable row level security;
alter table public.card_media          enable row level security;
alter table public.review_logs         enable row level security;
alter table public.deck_favorites      enable row level security;
alter table public.feature_suggestions enable row level security;
alter table public.plans               enable row level security;
alter table public.user_plans          enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.ai_credits          enable row level security;
alter table public.ai_credit_ledger    enable row level security;
alter table public.ai_credit_orders    enable row level security;
alter table public.collections         enable row level security;
alter table public.deck_collections    enable row level security;
alter table public.quizzes             enable row level security;
alter table public.quiz_questions      enable row level security;
alter table public.quiz_attempts       enable row level security;

create policy "profiles self read"  on public.profiles for select using (auth.uid() = id);
create policy "profiles self write" on public.profiles for update using (auth.uid() = id);

create policy "decks read own or public" on public.decks for select
  using (auth.uid() = owner_id or is_public);
create policy "decks write own" on public.decks for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "cards read own or public deck" on public.cards for select
  using (
    auth.uid() = owner_id
    or exists (select 1 from public.decks d where d.id = cards.deck_id and d.is_public)
  );
create policy "cards write own" on public.cards for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "achievements self" on public.achievements for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "card media owner read" on public.card_media for select
  using (auth.uid() = owner_id);
create policy "card media public read" on public.card_media for select
  using (
    exists (
      select 1 from public.decks d
      join public.cards c on c.deck_id = d.id
      where c.id = card_media.card_id and d.is_public
    )
  );

create policy "review_logs self insert" on public.review_logs for insert
  with check (auth.uid() = owner_id);
create policy "review_logs self read" on public.review_logs for select
  using (auth.uid() = owner_id);

-- Only a public or owned deck can be favorited (prevents leaking a private deck by id).
create policy "deck_favorites select own" on public.deck_favorites for select
  to authenticated using (user_id = auth.uid());
create policy "deck_favorites insert own" on public.deck_favorites for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.decks d
      where d.id = deck_id and (d.is_public or d.owner_id = auth.uid())
    )
  );
create policy "deck_favorites delete own" on public.deck_favorites for delete
  to authenticated using (user_id = auth.uid());

create policy "feature_suggestions insert own" on public.feature_suggestions for insert
  with check (auth.uid() = user_id);
create policy "feature_suggestions read own" on public.feature_suggestions for select
  using (auth.uid() = user_id);

create policy "plans public read" on public.plans for select
  to authenticated, anonymous using (true);

create policy "user plans self read" on public.user_plans for select
  to authenticated using (auth.uid() = user_id);

-- Billing and credits are read-only for the owner; writes go through server functions.
create policy "subscriptions_select_own" on public.subscriptions for select
  using (auth.uid() = user_id);
create policy "own ai_credits" on public.ai_credits for select
  using (auth.uid() = user_id);
create policy "own ai_credit_ledger" on public.ai_credit_ledger for select
  using (auth.uid() = user_id);
create policy "own ai_credit_orders" on public.ai_credit_orders for select
  using (auth.uid() = user_id);

create policy "collections read own or public" on public.collections for select
  using (auth.uid() = owner_id or is_public);
create policy "collections write own" on public.collections for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "deck_collections read" on public.deck_collections for select
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and (c.is_public or c.owner_id = auth.uid())
    )
  );
create policy "deck_collections write own" on public.deck_collections for all
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid())
    and exists (select 1 from public.decks d where d.id = deck_id and d.owner_id = auth.uid())
  );

create policy "quizzes read own or public" on public.quizzes for select
  using (
    auth.uid() = owner_id
    or exists (select 1 from public.collections c where c.id = collection_id and c.is_public)
  );
create policy "quizzes write own" on public.quizzes for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "quiz_questions read own or public" on public.quiz_questions for select
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.quizzes q
      join public.collections c on c.id = q.collection_id
      where q.id = quiz_id and c.is_public
    )
  );
create policy "quiz_questions write own" on public.quiz_questions for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "quiz_attempts self" on public.quiz_attempts for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
