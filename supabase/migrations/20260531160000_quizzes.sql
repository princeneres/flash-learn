-- Flash Learn — quizzes (a study mode that lives inside a collection).
-- A collection can hold decks AND quizzes. A quiz is a set of questions; an
-- attempt records a user's run through it (mirroring review_logs for analytics).

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  title text not null,
  description text,
  question_count int not null default 0,
  pass_threshold int,            -- % correct needed to pass; null = no gate
  order_index int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists quizzes_collection_idx
  on public.quizzes (collection_id, order_index);
create index if not exists quizzes_owner_idx
  on public.quizzes (owner_id);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  -- 'single' (one correct), 'multiple' (many correct), 'boolean' (true/false)
  kind text not null default 'single',
  -- [{ "id": "a", "text": "...", "correct": true }, ...]
  options jsonb not null default '[]'::jsonb,
  explanation text,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists quiz_questions_quiz_idx
  on public.quiz_questions (quiz_id, order_index);

-- One row per completed run; mirrors review_logs (client-recorded analytics).
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  quiz_id uuid references public.quizzes(id) on delete set null,
  collection_id uuid references public.collections(id) on delete set null,
  score int not null default 0,
  total int not null default 0,
  -- [{ "questionId": "...", "selected": ["a"], "correct": true }, ...]
  answers jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null default now()
);
create index if not exists quiz_attempts_owner_idx
  on public.quiz_attempts (owner_id, completed_at desc);
create index if not exists quiz_attempts_quiz_idx
  on public.quiz_attempts (quiz_id);

-- ============================================================
-- Triggers — keep quizzes.question_count denormalized
-- ============================================================

create or replace function public.bump_question_count() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.quizzes set question_count = question_count + 1 where id = new.quiz_id;
  elsif tg_op = 'DELETE' then
    update public.quizzes set question_count = greatest(question_count - 1, 0) where id = old.quiz_id;
  end if;
  return null;
end $$;

drop trigger if exists quiz_questions_count_trigger on public.quiz_questions;
create trigger quiz_questions_count_trigger
  after insert or delete on public.quiz_questions
  for each row execute function public.bump_question_count();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.quizzes        enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts  enable row level security;

-- A quiz is readable if its collection is own or public; writable by its owner.
drop policy if exists "quizzes read own or public" on public.quizzes;
create policy "quizzes read own or public" on public.quizzes for select
  using (
    auth.uid() = owner_id
    or exists (select 1 from public.collections c where c.id = collection_id and c.is_public)
  );
drop policy if exists "quizzes write own" on public.quizzes;
create policy "quizzes write own" on public.quizzes for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "quiz_questions read own or public" on public.quiz_questions;
create policy "quiz_questions read own or public" on public.quiz_questions for select
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.quizzes q
      join public.collections c on c.id = q.collection_id
      where q.id = quiz_id and c.is_public
    )
  );
drop policy if exists "quiz_questions write own" on public.quiz_questions;
create policy "quiz_questions write own" on public.quiz_questions for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Attempts are private to the user who made them.
drop policy if exists "quiz_attempts self" on public.quiz_attempts;
create policy "quiz_attempts self" on public.quiz_attempts for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ============================================================
-- Read RPCs — list a collection's quizzes with the owner's display name, so a
-- public collection's quizzes show correctly to non-owners (mirrors decks RPCs).
-- ============================================================

create or replace function public.get_collection_quizzes(p_collection_id uuid)
 returns table(
   id uuid, owner_id uuid, collection_id uuid, title text, description text,
   question_count integer, pass_threshold integer, order_index integer,
   created_at timestamp with time zone
 )
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    q.id, q.owner_id, q.collection_id, q.title, q.description,
    q.question_count, q.pass_threshold, q.order_index, q.created_at
  from public.quizzes q
  join public.collections c on c.id = q.collection_id
  where q.collection_id = p_collection_id
    and (c.is_public or c.owner_id = auth.uid())
  order by q.order_index, q.created_at;
$function$;

grant execute on function public.get_collection_quizzes(uuid) to authenticated;
