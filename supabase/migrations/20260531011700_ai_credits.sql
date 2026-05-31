-- AI credits: paid-only AI deck generation.
--
-- Users buy credits via AbacatePay (PIX). 1 credit = 1 generation, regardless of
-- how many cards are produced. New users get a few courtesy credits at signup.
--
-- Balances and ledger are written ONLY by the service role (edge functions) or by
-- the SECURITY DEFINER helpers below; clients can read their own rows but never
-- mutate them directly.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.ai_credits (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  balance    integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

-- Auditable history. `abacate_id` is unique so a replayed `billing.paid` webhook
-- can never credit the same payment twice.
create table if not exists public.ai_credit_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  delta      integer not null,
  reason     text not null, -- 'purchase' | 'generation' | 'refund' | 'courtesy'
  abacate_id text unique,
  created_at timestamptz not null default now()
);

create index if not exists ai_credit_ledger_user_idx
  on public.ai_credit_ledger (user_id, created_at desc);

-- Purchase orders, created (pending) before the user pays; flipped to paid by the
-- webhook once AbacatePay confirms the PIX.
create table if not exists public.ai_credit_orders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  pack_id      text not null,
  credits      integer not null,
  amount_cents integer not null,
  status       text not null default 'pending', -- pending | paid | expired
  abacate_id   text,
  created_at   timestamptz not null default now()
);

create index if not exists ai_credit_orders_user_idx
  on public.ai_credit_orders (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: read-only for the owner; all writes go through service role / definers.
-- ---------------------------------------------------------------------------

alter table public.ai_credits enable row level security;
alter table public.ai_credit_ledger enable row level security;
alter table public.ai_credit_orders enable row level security;

drop policy if exists "own ai_credits" on public.ai_credits;
create policy "own ai_credits" on public.ai_credits
  for select using (auth.uid() = user_id);

drop policy if exists "own ai_credit_ledger" on public.ai_credit_ledger;
create policy "own ai_credit_ledger" on public.ai_credit_ledger
  for select using (auth.uid() = user_id);

drop policy if exists "own ai_credit_orders" on public.ai_credit_orders;
create policy "own ai_credit_orders" on public.ai_credit_orders
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Atomically spend one credit. Raises INSUFFICIENT_CREDITS if the balance is 0,
-- so generation never proceeds without a paid credit. Returns the new balance.
create or replace function public.debit_ai_credit(p_user uuid)
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  new_balance integer;
begin
  update public.ai_credits
     set balance = balance - 1,
         updated_at = now()
   where user_id = p_user
     and balance > 0
  returning balance into new_balance;

  if new_balance is null then
    raise exception 'INSUFFICIENT_CREDITS' using errcode = 'P0001';
  end if;

  insert into public.ai_credit_ledger (user_id, delta, reason)
  values (p_user, -1, 'generation');

  return new_balance;
end;
$$;

-- Idempotent credit. If `p_abacate_id` is already present in the ledger, this is a
-- no-op (returns the current balance) — safe for webhook retries. Upserts the
-- balance row so a brand-new user can be credited.
create or replace function public.credit_ai(
  p_user uuid,
  p_amount integer,
  p_reason text,
  p_abacate_id text default null
)
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $$
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
end;
$$;

-- Balance for the authenticated caller (0 if no row yet).
create or replace function public.get_ai_credits()
  returns integer
  language sql
  stable
  security definer
  set search_path = public
as $$
  select coalesce(
    (select balance from public.ai_credits where user_id = auth.uid()),
    0
  );
$$;

grant execute on function public.get_ai_credits() to authenticated;

-- ---------------------------------------------------------------------------
-- Courtesy credits at signup (3 free generations to reduce first-use friction).
-- Extends the existing handle_new_user trigger function.
-- ---------------------------------------------------------------------------

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

  -- Courtesy AI credits for new accounts.
  insert into public.ai_credits (user_id, balance)
  values (new.id, 3)
  on conflict (user_id) do nothing;

  insert into public.ai_credit_ledger (user_id, delta, reason, abacate_id)
  values (new.id, 3, 'courtesy', 'courtesy:' || new.id)
  on conflict (abacate_id) do nothing;

  return new;
end $$;
