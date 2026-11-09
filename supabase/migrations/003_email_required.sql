-- Makes an email address required on every new request (the mobile number already is).
-- NOT VALID: requests already saved without an email are left alone; only new ones are checked.
-- Paste into Supabase → SQL Editor → Run, once.
alter table public.requests
  add constraint requests_email_required
  check (email is not null and email ~ '^\S+@\S+\.\S+$') not valid;
