-- Flash Learn media storage bucket + RLS
-- Apply via Supabase Dashboard SQL Editor or `supabase db push`.

-- ============================================================
-- Bucket
-- ============================================================

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

-- ============================================================
-- Policies on storage.objects
-- Path scheme: {uid}/{kind}/{ref}  (kind = 'image' | 'audio')
-- First folder of the object name must match the authenticated uid.
-- ============================================================

drop policy if exists "media read own"   on storage.objects;
drop policy if exists "media insert own" on storage.objects;
drop policy if exists "media update own" on storage.objects;
drop policy if exists "media delete own" on storage.objects;

create policy "media read own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "media insert own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "media update own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "media delete own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
