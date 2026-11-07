-- JLP Construction: MVP database (consultation requests)
-- Paste this whole file into Supabase → SQL Editor → Run. Safe to run once on a new project.
--
-- Security model (see CLAUDE.md):
--   * The public (anon) can't read or change any table directly.
--   * The public can only call submit_request() and taken_slots(), and upload photos
--     into the private "request-photos" bucket.
--   * Only admins (Jorge) can read and update requests, photos, and notes.

-- ---------- Admins ----------
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- Requests ----------
-- Choices are stored as keys (e.g. budget = 2, rooms = {kitchen}) so both languages display them.
create sequence public.request_ref_seq start 1001;

create table public.requests (
  id               uuid primary key default gen_random_uuid(),
  ref              text not null unique default ('JLP-' || nextval('public.request_ref_seq')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  lang             text not null check (lang in ('en', 'es')),

  -- contact (never sent to the AI)
  name             text not null check (char_length(name) between 1 and 120),
  phone            text not null check (char_length(phone) between 10 and 30),
  email            text check (email is null or char_length(email) <= 200),
  contact_pref     text not null check (contact_pref in ('text', 'email')),
  address          text not null check (char_length(address) between 1 and 200),
  city             text not null check (char_length(city) between 1 and 100),

  -- project
  rooms            text[] not null,
  services         text[] not null,
  other_service    text check (other_service is null or char_length(other_service) <= 200),
  description      text not null check (char_length(description) between 10 and 4000),
  size             text not null check (size in ('small', 'medium', 'large')),
  budget           smallint not null check (budget between 0 and 5),

  -- workflow
  slot             timestamptz,           -- requested / booked Saturday visit
  status           text not null default 'new'
                   check (status in ('new', 'needs-info', 'consult', 'quoted', 'won', 'declined')),
  quote_amount     numeric(10, 2) check (quote_amount is null or quote_amount >= 0),
  follow_up_due    timestamptz,

  -- text consent: when, what wording, and in which language they agreed
  sms_consent      boolean not null,
  sms_consent_at   timestamptz,
  sms_consent_text text,
  sms_consent_lang text check (sms_consent_lang is null or sms_consent_lang in ('en', 'es')),
  sms_stopped_at   timestamptz,

  no_feature       boolean not null default false  -- "don't feature my finished project"
);

-- Two people can't hold the same Saturday hour (declined requests free their slot).
create unique index requests_slot_taken on public.requests (slot)
  where slot is not null and status <> 'declined';
create index requests_created_at on public.requests (created_at desc);

create table public.request_photos (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.requests (id) on delete cascade,
  storage_path text not null,
  created_at   timestamptz not null default now()
);
create index request_photos_request on public.request_photos (request_id);

-- Notes: Jorge's own text (body) or an automatic event key (event), shown in his language.
create table public.notes (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  created_at timestamptz not null default now(),
  body       text check (body is null or char_length(body) <= 2000),
  event      text,
  check (body is not null or event is not null)
);
create index notes_request on public.notes (request_id, created_at);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger requests_touch before update on public.requests
  for each row execute function public.touch_updated_at();

-- ---------- Row Level Security ----------
alter table public.admins         enable row level security;
alter table public.requests       enable row level security;
alter table public.request_photos enable row level security;
alter table public.notes          enable row level security;

revoke all on public.admins, public.requests, public.request_photos, public.notes from anon;

create policy "admins see themselves" on public.admins
  for select to authenticated using (user_id = auth.uid());

create policy "admin full access" on public.requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin full access" on public.request_photos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin full access" on public.notes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Public functions ----------
-- Which future Saturday hours are already taken (times only, no personal data).
create or replace function public.taken_slots()
returns setof timestamptz
language sql stable security definer set search_path = ''
as $$
  select slot from public.requests
  where slot is not null and slot > now() and status <> 'declined';
$$;

-- The website's "Submit request" button. Checks every field on the server, saves the
-- request and its photo paths, and returns the reference number (e.g. JLP-1001).
create or replace function public.submit_request(p jsonb)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id       uuid   := (p->>'id')::uuid;
  v_rooms    text[] := array(select jsonb_array_elements_text(coalesce(p->'rooms', '[]')));
  v_services text[] := array(select jsonb_array_elements_text(coalesce(p->'services', '[]')));
  v_photos   text[] := array(select jsonb_array_elements_text(coalesce(p->'photos', '[]')));
  v_slot     timestamptz := (p->>'slot')::timestamptz;
  v_local    timestamp;
  v_pref     text := p->>'contact_pref';
  v_email    text := nullif(btrim(coalesce(p->>'email', '')), '');
  v_ref      text;
  v_path     text;
begin
  if v_id is null then raise exception 'invalid_id'; end if;
  if cardinality(v_rooms) = 0
     or not v_rooms <@ array['kitchen','bathroom','bedroom','living','basement','exterior'] then
    raise exception 'invalid_rooms';
  end if;
  if cardinality(v_services) = 0
     or not v_services <@ array['interior','painting','tile','flooring','windows','other'] then
    raise exception 'invalid_services';
  end if;
  if length(regexp_replace(coalesce(p->>'phone', ''), '\D', '', 'g')) < 10 then
    raise exception 'invalid_phone';
  end if;
  if v_pref = 'email' and (v_email is null or v_email !~ '^\S+@\S+\.\S+$') then
    raise exception 'invalid_email';
  end if;
  if coalesce((p->>'sms_consent')::boolean, false) is not true then
    raise exception 'consent_required';
  end if;

  -- Saturday, 9 am – 5 pm start, on the hour, Chicago time, within the next 4 weeks
  if v_slot is null then raise exception 'slot_required'; end if;
  v_local := v_slot at time zone 'America/Chicago';
  if extract(isodow from v_local) <> 6
     or extract(hour from v_local) not between 9 and 17
     or extract(minute from v_local) <> 0 or extract(second from v_local) <> 0
     or v_slot <= now() or v_slot > now() + interval '29 days' then
    raise exception 'invalid_slot';
  end if;

  if cardinality(v_photos) > 6 then raise exception 'too_many_photos'; end if;
  foreach v_path in array v_photos loop
    if v_path not like v_id::text || '/%' then raise exception 'invalid_photo_path'; end if;
  end loop;

  begin
    insert into public.requests (
      id, lang, name, phone, email, contact_pref, address, city,
      rooms, services, other_service, description, size, budget, slot,
      sms_consent, sms_consent_at, sms_consent_text, sms_consent_lang, no_feature
    ) values (
      v_id,
      p->>'lang',
      btrim(p->>'name'),
      btrim(p->>'phone'),
      v_email,
      v_pref,
      btrim(p->>'address'),
      btrim(p->>'city'),
      v_rooms,
      v_services,
      case when 'other' = any (v_services) then nullif(btrim(coalesce(p->>'other_service', '')), '') end,
      btrim(p->>'description'),
      p->>'size',
      (p->>'budget')::smallint,
      v_slot,
      true,
      now(),
      p->>'sms_consent_text',
      p->>'lang',
      coalesce((p->>'no_feature')::boolean, false)
    )
    returning ref into v_ref;
  exception when unique_violation then
    raise exception 'slot_taken';
  end;

  insert into public.request_photos (request_id, storage_path)
  select v_id, unnest(v_photos);

  return v_ref;
end $$;

revoke execute on function public.submit_request(jsonb), public.taken_slots(), public.is_admin() from public;
grant execute on function public.submit_request(jsonb), public.taken_slots() to anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------- Photo storage (private) ----------
-- Customer photos are only for planning: private bucket, JPEG only, 5 MB max each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('request-photos', 'request-photos', false, 5242880, array['image/jpeg']);

create policy "public can upload request photos" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'request-photos');
create policy "admin can view request photos" on storage.objects
  for select to authenticated using (bucket_id = 'request-photos' and public.is_admin());
