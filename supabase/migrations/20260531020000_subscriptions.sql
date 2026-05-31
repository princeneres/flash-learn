-- Subscriptions (Pro plan) — recurring access tier, complements per-use AI credits.
--
-- Design: reuses the existing plans / user_plans architecture instead of a parallel
-- table. A 'pro' plan row defines the unlocked limits; user_plans.plan_id + expires_at
-- track who has it and until when. A separate `subscriptions` table holds the billing
-- state (AbacatePay subscription id, status) and lets the webhook apply renewals
-- idempotently. All writes happen via SECURITY DEFINER RPCs called by the
-- create-subscription / abacate-webhook edge functions (service role).

-- 1. Pro plan definition. Seeded idempotently; tune the numbers in the dashboard.
insert into public.plans (id, name, max_decks, max_total_cards, max_cards_per_deck, max_media_bytes, features)
values (
  'pro',
  'Pro',
  1000,                 -- max_decks (effectively unlimited)
  1000000,              -- max_total_cards
  10000,                -- max_cards_per_deck
  5368709120,           -- max_media_bytes (5 GiB)
  '{"advancedStats": true, "export": true, "media": true, "monthlyCredits": 30}'::jsonb
)
on conflict (id) do nothing;

-- 2. Fix get_user_plan: it ignored user_plans.expires_at, so an expired Pro plan would
--    keep applying forever. Now an expired/missing assignment falls back to 'free'.
create or replace function public.get_user_plan(uid uuid)
 returns public.plans
 language sql
 stable security definer
 set search_path to 'public'
as $function$
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
$function$;

-- 3. Billing state for AbacatePay subscriptions.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled')),
  abacate_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subscriptions_abacate_id_idx
  on public.subscriptions (abacate_subscription_id)
  where abacate_subscription_id is not null;

alter table public.subscriptions enable row level security;

-- Users may read their own subscription; all writes are service-role only (RPCs below).
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- 4. apply_subscription: upserts billing state + user_plans assignment atomically.
--    Called by the webhook on subscription.completed / subscription.renewed.
create or replace function public.apply_subscription(
  p_user uuid,
  p_plan text,
  p_status text,
  p_period_end timestamptz,
  p_abacate_id text
)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
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
end $function$;

-- 5. cancel_subscription: marks canceled but keeps access until current_period_end.
--    user_plans.expires_at already gates access, so we only flip the status flag.
create or replace function public.cancel_subscription(p_user uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
begin
  update public.subscriptions
    set status = 'canceled', updated_at = now()
    where user_id = p_user;
end $function$;

revoke all on function public.apply_subscription(uuid, text, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.cancel_subscription(uuid) from public, anon, authenticated;
