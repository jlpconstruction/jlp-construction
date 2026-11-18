-- Locks down submissions so every request has to pass the spam check.
-- Run this LAST: after the submit-request Edge Function is deployed and the new site is live.
-- Paste into Supabase → SQL Editor → Run, once.

-- Only the server step (the submit-request Edge Function) may save requests.
revoke execute on function public.submit_request(jsonb) from anon, authenticated;
grant execute on function public.submit_request(jsonb) to service_role;

-- No more direct photo uploads from browsers. Customers upload through the one-time
-- links the Edge Function hands out, and only for a request that passed the spam check.
drop policy if exists "public can upload request photos" on storage.objects;
