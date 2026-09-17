-- Bucket privat pentru fotografii (lucrări, bonuri, scule).
--
-- Convenția de cale: `<user_id>/<folder>/<fișier>`. Politicile verifică primul
-- segment, deci nimeni nu poate citi sau scrie în folderul altcuiva.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-photos',
  'job-photos',
  false,
  10485760, -- 10 MB; pozele sunt oricum comprimate pe telefon
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "job_photos_select_own" on storage.objects;
create policy "job_photos_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "job_photos_insert_own" on storage.objects;
create policy "job_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "job_photos_update_own" on storage.objects;
create policy "job_photos_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "job_photos_delete_own" on storage.objects;
create policy "job_photos_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
