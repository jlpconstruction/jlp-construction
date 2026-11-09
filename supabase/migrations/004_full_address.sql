-- Saves the full project address: adds State (IL/IN) and ZIP code, and checks them on every new request.
-- Also requires an email on every request, matching the form. Older requests are left as they are.
-- Paste into Supabase → SQL Editor → Run, once (after 002 and 003).

alter table public.requests
  add column if not exists state text check (state is null or state in ('IL', 'IN')),
  add column if not exists zip   text check (zip is null or zip ~ '^\d{5}$');

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
  v_address  text := btrim(coalesce(p->>'address', ''));
  v_state    text := p->>'state';
  v_zip      text := btrim(coalesce(p->>'zip', ''));
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
  if v_email is null or v_email !~ '^\S+@\S+\.\S+$' then
    raise exception 'invalid_email';
  end if;
  -- Full address: a street with a house number, a city, IL or IN, and a 5-digit ZIP
  if v_address !~ '\d' or btrim(coalesce(p->>'city', '')) = ''
     or v_state is null or v_state not in ('IL', 'IN') or v_zip !~ '^\d{5}$' then
    raise exception 'invalid_address';
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
      id, lang, name, phone, email, contact_pref, address, city, state, zip,
      rooms, services, other_service, description, size, budget, slot,
      sms_consent, sms_consent_at, sms_consent_text, sms_consent_lang, no_feature
    ) values (
      v_id,
      p->>'lang',
      btrim(p->>'name'),
      btrim(p->>'phone'),
      v_email,
      v_pref,
      v_address,
      btrim(p->>'city'),
      v_state,
      v_zip,
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
