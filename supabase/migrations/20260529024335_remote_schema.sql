alter table "public"."decks" drop column "owner_name";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_public_decks()
 RETURNS TABLE(id uuid, owner_id uuid, owner_name text, title text, category text, tags text[], is_public boolean, card_count integer, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  where d.is_public
  order by d.created_at desc;
$function$
;


  create policy "avatars delete own"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "avatars insert own"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "avatars public read"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'avatars'::text));



  create policy "avatars update own"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)))
with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



