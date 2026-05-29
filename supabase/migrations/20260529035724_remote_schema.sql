drop extension if exists "pg_net";


  create table "public"."card_media" (
    "card_id" uuid not null,
    "owner_id" uuid not null,
    "ref" text not null,
    "kind" text not null
      );


alter table "public"."card_media" enable row level security;


  create table "public"."plans" (
    "id" text not null,
    "name" text not null,
    "max_decks" integer not null,
    "max_total_cards" integer not null,
    "max_cards_per_deck" integer not null,
    "max_media_bytes" bigint not null,
    "features" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."plans" enable row level security;


  create table "public"."review_logs" (
    "id" uuid not null default gen_random_uuid(),
    "owner_id" uuid not null,
    "card_id" uuid,
    "deck_id" uuid,
    "deck_category" text,
    "quality" smallint not null,
    "was_correct" boolean not null,
    "prev_status" text,
    "reviewed_at" timestamp with time zone not null default now()
      );


alter table "public"."review_logs" enable row level security;


  create table "public"."user_plans" (
    "user_id" uuid not null,
    "plan_id" text not null,
    "activated_at" timestamp with time zone not null default now(),
    "expires_at" timestamp with time zone
      );


alter table "public"."user_plans" enable row level security;

alter table "public"."cards" add column "tags" text[] not null default '{}'::text[];

CREATE INDEX card_media_owner_ref_idx ON public.card_media USING btree (owner_id, ref);

CREATE UNIQUE INDEX card_media_pkey ON public.card_media USING btree (card_id, ref, kind);

CREATE INDEX cards_tags_idx ON public.cards USING gin (tags);

CREATE UNIQUE INDEX plans_pkey ON public.plans USING btree (id);

CREATE INDEX review_logs_owner_category_idx ON public.review_logs USING btree (owner_id, deck_category);

CREATE INDEX review_logs_owner_time_idx ON public.review_logs USING btree (owner_id, reviewed_at DESC);

CREATE UNIQUE INDEX review_logs_pkey ON public.review_logs USING btree (id);

CREATE UNIQUE INDEX user_plans_pkey ON public.user_plans USING btree (user_id);

alter table "public"."card_media" add constraint "card_media_pkey" PRIMARY KEY using index "card_media_pkey";

alter table "public"."plans" add constraint "plans_pkey" PRIMARY KEY using index "plans_pkey";

alter table "public"."review_logs" add constraint "review_logs_pkey" PRIMARY KEY using index "review_logs_pkey";

alter table "public"."user_plans" add constraint "user_plans_pkey" PRIMARY KEY using index "user_plans_pkey";

alter table "public"."card_media" add constraint "card_media_card_id_fkey" FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE CASCADE not valid;

alter table "public"."card_media" validate constraint "card_media_card_id_fkey";

alter table "public"."card_media" add constraint "card_media_kind_check" CHECK ((kind = ANY (ARRAY['audio'::text, 'image'::text]))) not valid;

alter table "public"."card_media" validate constraint "card_media_kind_check";

alter table "public"."card_media" add constraint "card_media_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."card_media" validate constraint "card_media_owner_id_fkey";

alter table "public"."review_logs" add constraint "review_logs_card_id_fkey" FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE SET NULL not valid;

alter table "public"."review_logs" validate constraint "review_logs_card_id_fkey";

alter table "public"."review_logs" add constraint "review_logs_deck_id_fkey" FOREIGN KEY (deck_id) REFERENCES public.decks(id) ON DELETE SET NULL not valid;

alter table "public"."review_logs" validate constraint "review_logs_deck_id_fkey";

alter table "public"."review_logs" add constraint "review_logs_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."review_logs" validate constraint "review_logs_owner_id_fkey";

alter table "public"."review_logs" add constraint "review_logs_quality_check" CHECK (((quality >= 0) AND (quality <= 5))) not valid;

alter table "public"."review_logs" validate constraint "review_logs_quality_check";

alter table "public"."user_plans" add constraint "user_plans_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES public.plans(id) not valid;

alter table "public"."user_plans" validate constraint "user_plans_plan_id_fkey";

alter table "public"."user_plans" add constraint "user_plans_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_plans" validate constraint "user_plans_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.enforce_card_quota()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  select coalesce(card_count, 0) into deck_cards
    from public.decks where id = new.deck_id;
  if deck_cards >= plan.max_cards_per_deck then
    raise exception '%', json_build_object(
      'code', 'DECK_CARD_LIMIT_REACHED',
      'limit', plan.max_cards_per_deck,
      'current', deck_cards,
      'plan', plan.id
    )::text using errcode = 'P0001';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.enforce_deck_quota()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.get_leaderboard()
 RETURNS TABLE(id uuid, display_name text, photo_url text, points integer, total_reviews integer, streak integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id, display_name, photo_url, points, total_reviews, streak
  from public.profiles
  order by points desc, total_reviews desc
  limit 50;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_limits()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.get_user_plan(uid uuid)
 RETURNS public.plans
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.* from public.plans p
  join public.user_plans up on up.plan_id = p.id
  where up.user_id = uid
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.protect_profile_stats()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if current_setting('app.allow_stats_write', true) is distinct from 'on' then
    new.points          := old.points;
    new.total_reviews   := old.total_reviews;
    new.streak          := old.streak;
    new.last_study_date := old.last_study_date;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.record_review(p_card_id uuid, p_quality integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.sync_card_media()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  insert into public.user_plans (user_id, plan_id)
  values (new.id, 'free')
  on conflict (user_id) do nothing;

  return new;
end $function$
;

grant delete on table "public"."card_media" to "anon";

grant insert on table "public"."card_media" to "anon";

grant references on table "public"."card_media" to "anon";

grant select on table "public"."card_media" to "anon";

grant trigger on table "public"."card_media" to "anon";

grant truncate on table "public"."card_media" to "anon";

grant update on table "public"."card_media" to "anon";

grant delete on table "public"."card_media" to "authenticated";

grant insert on table "public"."card_media" to "authenticated";

grant references on table "public"."card_media" to "authenticated";

grant select on table "public"."card_media" to "authenticated";

grant trigger on table "public"."card_media" to "authenticated";

grant truncate on table "public"."card_media" to "authenticated";

grant update on table "public"."card_media" to "authenticated";

grant delete on table "public"."card_media" to "service_role";

grant insert on table "public"."card_media" to "service_role";

grant references on table "public"."card_media" to "service_role";

grant select on table "public"."card_media" to "service_role";

grant trigger on table "public"."card_media" to "service_role";

grant truncate on table "public"."card_media" to "service_role";

grant update on table "public"."card_media" to "service_role";

grant delete on table "public"."plans" to "anon";

grant insert on table "public"."plans" to "anon";

grant references on table "public"."plans" to "anon";

grant select on table "public"."plans" to "anon";

grant trigger on table "public"."plans" to "anon";

grant truncate on table "public"."plans" to "anon";

grant update on table "public"."plans" to "anon";

grant delete on table "public"."plans" to "authenticated";

grant insert on table "public"."plans" to "authenticated";

grant references on table "public"."plans" to "authenticated";

grant select on table "public"."plans" to "authenticated";

grant trigger on table "public"."plans" to "authenticated";

grant truncate on table "public"."plans" to "authenticated";

grant update on table "public"."plans" to "authenticated";

grant delete on table "public"."plans" to "service_role";

grant insert on table "public"."plans" to "service_role";

grant references on table "public"."plans" to "service_role";

grant select on table "public"."plans" to "service_role";

grant trigger on table "public"."plans" to "service_role";

grant truncate on table "public"."plans" to "service_role";

grant update on table "public"."plans" to "service_role";

grant delete on table "public"."review_logs" to "anon";

grant insert on table "public"."review_logs" to "anon";

grant references on table "public"."review_logs" to "anon";

grant select on table "public"."review_logs" to "anon";

grant trigger on table "public"."review_logs" to "anon";

grant truncate on table "public"."review_logs" to "anon";

grant update on table "public"."review_logs" to "anon";

grant delete on table "public"."review_logs" to "authenticated";

grant insert on table "public"."review_logs" to "authenticated";

grant references on table "public"."review_logs" to "authenticated";

grant select on table "public"."review_logs" to "authenticated";

grant trigger on table "public"."review_logs" to "authenticated";

grant truncate on table "public"."review_logs" to "authenticated";

grant update on table "public"."review_logs" to "authenticated";

grant delete on table "public"."review_logs" to "service_role";

grant insert on table "public"."review_logs" to "service_role";

grant references on table "public"."review_logs" to "service_role";

grant select on table "public"."review_logs" to "service_role";

grant trigger on table "public"."review_logs" to "service_role";

grant truncate on table "public"."review_logs" to "service_role";

grant update on table "public"."review_logs" to "service_role";

grant delete on table "public"."user_plans" to "anon";

grant insert on table "public"."user_plans" to "anon";

grant references on table "public"."user_plans" to "anon";

grant select on table "public"."user_plans" to "anon";

grant trigger on table "public"."user_plans" to "anon";

grant truncate on table "public"."user_plans" to "anon";

grant update on table "public"."user_plans" to "anon";

grant delete on table "public"."user_plans" to "authenticated";

grant insert on table "public"."user_plans" to "authenticated";

grant references on table "public"."user_plans" to "authenticated";

grant select on table "public"."user_plans" to "authenticated";

grant trigger on table "public"."user_plans" to "authenticated";

grant truncate on table "public"."user_plans" to "authenticated";

grant update on table "public"."user_plans" to "authenticated";

grant delete on table "public"."user_plans" to "service_role";

grant insert on table "public"."user_plans" to "service_role";

grant references on table "public"."user_plans" to "service_role";

grant select on table "public"."user_plans" to "service_role";

grant trigger on table "public"."user_plans" to "service_role";

grant truncate on table "public"."user_plans" to "service_role";

grant update on table "public"."user_plans" to "service_role";


  create policy "card media owner read"
  on "public"."card_media"
  as permissive
  for select
  to public
using ((auth.uid() = owner_id));



  create policy "card media public read"
  on "public"."card_media"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM (public.decks d
     JOIN public.cards c ON ((c.deck_id = d.id)))
  WHERE ((c.id = card_media.card_id) AND (d.is_public = true)))));



  create policy "plans public read"
  on "public"."plans"
  as permissive
  for select
  to authenticated, anon
using (true);



  create policy "review_logs self insert"
  on "public"."review_logs"
  as permissive
  for insert
  to public
with check ((auth.uid() = owner_id));



  create policy "review_logs self read"
  on "public"."review_logs"
  as permissive
  for select
  to public
using ((auth.uid() = owner_id));



  create policy "user plans self read"
  on "public"."user_plans"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));


CREATE TRIGGER cards_media_sync AFTER INSERT OR UPDATE OF front, back, front_audio, back_audio ON public.cards FOR EACH ROW EXECUTE FUNCTION public.sync_card_media();

CREATE TRIGGER cards_quota_trigger BEFORE INSERT ON public.cards FOR EACH ROW EXECUTE FUNCTION public.enforce_card_quota();

CREATE TRIGGER decks_quota_trigger BEFORE INSERT ON public.decks FOR EACH ROW EXECUTE FUNCTION public.enforce_deck_quota();

CREATE TRIGGER profiles_protect_stats BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_stats();


  create policy "media public deck read"
  on "storage"."objects"
  as permissive
  for select
  to authenticated, anon
using (((bucket_id = 'media'::text) AND (EXISTS ( SELECT 1
   FROM ((public.card_media cm
     JOIN public.cards c ON ((c.id = cm.card_id)))
     JOIN public.decks d ON ((d.id = c.deck_id)))
  WHERE ((d.is_public = true) AND ((cm.owner_id)::text = (storage.foldername(objects.name))[1]) AND (storage.filename(objects.name) = cm.ref))))));



