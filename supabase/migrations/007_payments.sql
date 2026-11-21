-- Payments tracker: the 35/35/30 payments for each accepted job.
-- A row is saved when Jorge marks a payment as received; no row = not paid yet.
-- The amounts due are worked out from the job total (requests.quote_amount).
-- Run this BEFORE pushing the site. Paste into Supabase → SQL Editor → Run, once.

create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.requests (id) on delete cascade,
  stage       smallint not null check (stage between 1 and 3), -- 1 = first week (35%), 2 = halfway (35%), 3 = completion (30%)
  amount      numeric(10, 2) not null check (amount >= 0),     -- what was actually received
  method      text not null check (method in ('cash', 'check', 'zelle', 'card', 'other')),
  paid_on     date not null,
  created_at  timestamptz not null default now(),
  unique (request_id, stage)
);

-- Only Jorge (admins) can see or change payments. The public has no access at all.
alter table public.payments enable row level security;
revoke all on public.payments from anon;
create policy "admin full access" on public.payments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
