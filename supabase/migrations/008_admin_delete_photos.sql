-- Lets Jorge delete a request's photos when he deletes the request (the "Borrar solicitud"
-- button). Before this, admins could only view photos. Deleting the request itself also
-- deletes its photo records, notes, and payments (they cascade).
-- Run this BEFORE pushing the site. Paste into Supabase → SQL Editor → Run, once.

create policy "admin can delete request photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'request-photos' and public.is_admin());
