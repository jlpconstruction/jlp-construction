-- AI project brief: a short Spanish summary Claude writes for Jorge from the request's
-- photos and description. Saved on the request so it's only generated once.
-- Run this BEFORE deploying the project-brief function and before pushing the site.
-- Paste into Supabase → SQL Editor → Run, once.

alter table public.requests
  add column if not exists ai_brief    jsonb,
  add column if not exists ai_brief_at timestamptz;

-- No new policies needed: only Jorge (admins) can read requests, and only the
-- project-brief Edge Function (service role) writes these columns.
