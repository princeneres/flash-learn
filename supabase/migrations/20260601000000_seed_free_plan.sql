-- Seed the default 'free' plan.
--
-- Every new user is assigned 'free' (handle_new_user) and get_user_plan falls
-- back to it, but no migration created the row: on a fresh database the quota
-- triggers raised PLAN_NOT_FOUND and nobody could create a deck. Idempotent, so
-- databases that already have the row keep their tuned limits.
insert into public.plans (id, name, max_decks, max_total_cards, max_cards_per_deck, max_media_bytes, features)
values (
  'free',
  'Free',
  10,                   -- max_decks
  1000,                 -- max_total_cards
  100,                  -- max_cards_per_deck
  104857600,            -- max_media_bytes (100 MiB)
  '{}'::jsonb
)
on conflict (id) do nothing;
