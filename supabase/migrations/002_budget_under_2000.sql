-- Adds the "Under $2,000" budget choice (saved as 6).
-- Choice 0 now means "$2,000 – $5,000" (it used to be "Under $5,000").
-- Paste into Supabase → SQL Editor → Run, once.
alter table public.requests drop constraint if exists requests_budget_check;
alter table public.requests add constraint requests_budget_check check (budget between 0 and 6);
