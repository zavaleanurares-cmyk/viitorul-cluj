-- Locker Room · Faza 4 · Club: înscrieri (de la cerere la jucător) și infrastructura formularelor publice.
--
-- Fluxul: formularul public (sau biroul) creează o cerere → biroul programează proba pe un antrenament al echipei
-- → antrenorul notează proba → „Înscrie" creează jucătorul, leagă părintele plătitor, emite prima taxă;
-- contractul și contul părintelui se trimit din aplicație imediat după.
-- Formularele publice trec prin funcții definer cu limită de trimiteri pe IP (amprentat, nu stocat în clar).

-- ---------------------------------------------------------------------------
-- Limitarea formularelor publice
-- ---------------------------------------------------------------------------
create table private.public_hits (
  club_id  uuid not null,
  kind     text not null,
  ip_hash  text not null,
  at       timestamptz not null default now()
);
create index public_hits_idx on private.public_hits (club_id, kind, ip_hash, at);

/** true dacă trimiterea e permisă (și o înregistrează): cel mult p_per_hour pe IP și p_per_day pe club. */
create or replace function private.public_hit(p_club uuid, p_kind text, p_ip text, p_per_hour int default 5, p_per_day int default 200)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_hash text := encode(sha256(convert_to(coalesce(p_ip, '') || ':' || p_club::text, 'UTF8')), 'hex');
begin
  delete from private.public_hits where at < now() - interval '2 days';
  if (select count(*) from private.public_hits where club_id = p_club and kind = p_kind and ip_hash = v_hash and at > now() - interval '1 hour') >= p_per_hour
     or (select count(*) from private.public_hits where club_id = p_club and kind = p_kind and at > now() - interval '1 day') >= p_per_day then
    return false;
  end if;
  insert into private.public_hits (club_id, kind, ip_hash) values (p_club, p_kind, v_hash);
  return true;
end $$;

/** Clubul după slug, pentru paginile publice. */
create or replace function private.club_by_slug(p_slug text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.clubs where slug = lower(trim(p_slug))
$$;

-- ---------------------------------------------------------------------------
-- Mărimea echipamentului (folosită la înscriere și în magazin)
-- ---------------------------------------------------------------------------
alter table public.players add column kit_size text check (kit_size is null or length(kit_size) between 1 and 12);
grant select (kit_size), update (kit_size) on public.players to authenticated;

/** Părintele (sau jucătorul) își trece mărimea; biroul o poate schimba din fișa jucătorului. */
create or replace function public.set_kit_size(p_player uuid, p_size text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (p_player = any (private.my_player_ids()) or private.can_manage_player(p_player)) then
    raise exception 'Acces interzis' using errcode = '42501';
  end if;
  update public.players set kit_size = nullif(trim(p_size), '') where id = p_player;
end $$;
grant execute on function public.set_kit_size(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Cererile de înscriere
-- ---------------------------------------------------------------------------
create table public.enrolment_requests (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references public.clubs(id) on delete cascade,
  status          text not null default 'new' check (status in ('new', 'trial', 'trial_done', 'enrolled', 'declined', 'withdrawn')),
  child_name      text not null check (length(child_name) between 3 and 120),
  birth_date      date not null,
  group_id        uuid references public.groups(id) on delete set null,
  previous_club   text check (length(previous_club) <= 120),
  position        text check (position in ('GK', 'DEF', 'MID', 'FWD')),
  notes           text check (length(notes) <= 1000),
  parent_name     text not null check (length(parent_name) between 3 and 120),
  parent_email    text check (parent_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  parent_phone    text check (length(parent_phone) between 6 and 20),
  relation        text not null default 'parent' check (relation in ('mother', 'father', 'parent', 'guardian', 'other')),
  source          text not null default 'public' check (source in ('public', 'office')),
  consent_at      timestamptz,
  trial_event_id  uuid references public.events(id) on delete set null,
  trial_at        timestamptz,
  trial_rating    smallint check (trial_rating between 1 and 5),
  trial_note      text check (length(trial_note) <= 1000),
  decline_reason  text check (length(decline_reason) <= 500),
  player_id       uuid references public.players(id) on delete set null,
  guardian_id     uuid references public.guardians(id) on delete set null,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (parent_email is not null or parent_phone is not null)
);
create index enrolment_requests_club_idx on public.enrolment_requests (club_id, status, created_at desc);
create index enrolment_requests_event_idx on public.enrolment_requests (trial_event_id);

create table public.enrolment_events (
  id          bigint generated always as identity primary key,
  request_id  uuid not null references public.enrolment_requests(id) on delete cascade,
  at          timestamptz not null default now(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null check (action in ('created', 'trial_booked', 'trial_done', 'enrolled', 'declined', 'withdrawn', 'reopened', 'note')),
  note        text check (length(note) <= 1000)
);
create index enrolment_events_req_idx on public.enrolment_events (request_id, at);

create or replace function private.can_manage_enrolment() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.my_role()) in ('admin', 'secretary', 'sporting_director'), false)
$$;
grant execute on function private.can_manage_enrolment() to authenticated;

alter table public.enrolment_requests enable row level security;
alter table public.enrolment_events enable row level security;
create policy enrolment_requests_select on public.enrolment_requests for select to authenticated
  using (club_id = (select private.my_club()) and (select private.can_manage_enrolment()));
create policy enrolment_events_select on public.enrolment_events for select to authenticated
  using (exists (select 1 from public.enrolment_requests r where r.id = request_id and r.club_id = (select private.my_club()))
         and (select private.can_manage_enrolment()));
grant select on public.enrolment_requests, public.enrolment_events to authenticated;

create or replace function private.enrolment_log(p_id uuid, p_action text, p_note text default null) returns void
language sql security definer set search_path = '' as $$
  insert into public.enrolment_events (request_id, actor_id, action, note) values (p_id, app_auth.uid(), p_action, left(p_note, 1000));
  update public.enrolment_requests set updated_at = now() where id = p_id;
$$;

/**
 * Echipa potrivită anului nașterii: întâi grupele cu ani setați; altfel după numele „U<n>" (cea mai mică
 * grupă în care copilul încă intră, cel mult 3 ani peste vârsta lui); altfel nicio echipă.
 */
create or replace function private.group_for_birth(p_club uuid, p_birth date) returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select g.id from public.groups g
     where g.club_id = p_club and g.is_active and g.birth_year_from is not null
       and extract(year from p_birth)::int between g.birth_year_from and coalesce(g.birth_year_to, g.birth_year_from)
     order by g.sort limit 1),
    (select g.id from public.groups g
     where g.club_id = p_club and g.is_active and g.name ~* '^U\s?[0-9]{1,2}\y'
       and (substring(g.name from '(?i)^U\s?([0-9]{1,2})'))::int - (extract(year from private.club_today(p_club))::int - extract(year from p_birth)::int) between 1 and 3
     order by (substring(g.name from '(?i)^U\s?([0-9]{1,2})'))::int, g.sort limit 1))
$$;

-- p = { child_name, birth_date, group_id?, previous_club?, position?, notes?, parent_name, parent_email?, parent_phone?, relation? }
create or replace function private.insert_enrolment(p_club uuid, p jsonb, p_source text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_birth date := (p->>'birth_date')::date; v_group uuid := nullif(p->>'group_id', '')::uuid;
begin
  if v_birth is null or v_birth > private.club_today(p_club) or v_birth < private.club_today(p_club) - interval '60 years' then
    raise exception 'Data nașterii nu e validă.' using errcode = '22023';
  end if;
  if v_group is not null and not exists (select 1 from public.groups g where g.id = v_group and g.club_id = p_club and g.is_active) then
    v_group := null;
  end if;
  insert into public.enrolment_requests (club_id, child_name, birth_date, group_id, previous_club, position, notes,
    parent_name, parent_email, parent_phone, relation, source, consent_at, created_by)
  values (p_club, trim(p->>'child_name'), v_birth, coalesce(v_group, private.group_for_birth(p_club, v_birth)),
    nullif(trim(p->>'previous_club'), ''), nullif(p->>'position', ''), nullif(trim(p->>'notes'), ''),
    trim(p->>'parent_name'), nullif(lower(trim(p->>'parent_email')), ''), nullif(regexp_replace(coalesce(p->>'parent_phone', ''), '[^0-9+]', '', 'g'), ''),
    coalesce(nullif(p->>'relation', ''), 'parent'), p_source, case when p_source = 'public' then now() end,
    case when p_source = 'office' then app_auth.uid() end)
  returning id into v_id;
  insert into public.enrolment_events (request_id, actor_id, action) values (v_id, case when p_source = 'office' then app_auth.uid() end, 'created');
  return v_id;
end $$;

/** Formularul public de înscriere (fără cont). Limitat pe IP; anunță biroul. */
create or replace function public.submit_enrolment_request(p_slug text, p jsonb, p_ip text default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.club_by_slug(p_slug); v_id uuid;
begin
  if v_club is null then raise exception 'Clubul nu a fost găsit.' using errcode = 'P0002'; end if;
  if coalesce((select c.settings->'site'->>'enrolment' from public.clubs c where c.id = v_club), 'true') = 'false' then
    raise exception 'Înscrierile online sunt închise.' using errcode = '22023';
  end if;
  if coalesce((p->>'consent')::boolean, false) is not true then
    raise exception 'Este nevoie de acordul pentru prelucrarea datelor.' using errcode = '22023';
  end if;
  if not private.public_hit(v_club, 'enrolment', p_ip, 5, 100) then
    raise exception 'Prea multe trimiteri. Încearcă din nou peste o oră.' using errcode = '54000';
  end if;
  v_id := private.insert_enrolment(v_club, p, 'public');
  perform private.notify_users(v_club, array['admin', 'secretary', 'sporting_director']::public.app_role[], 'enrolment',
    'Cerere de înscriere: ' || trim(p->>'child_name'), to_char((p->>'birth_date')::date, 'YYYY'), '/club/inscrieri/' || v_id, 'enrolment:' || v_id);
  return true;
end $$;
grant execute on function public.submit_enrolment_request(text, jsonb, text) to anon, authenticated;

create or replace function public.create_enrolment_request(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_enrolment() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  return private.insert_enrolment(private.my_club(), p, 'office');
end $$;

create or replace function public.update_enrolment_request(p_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_enrolment() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  update public.enrolment_requests set
    child_name = coalesce(nullif(trim(p->>'child_name'), ''), child_name),
    birth_date = coalesce((p->>'birth_date')::date, birth_date),
    group_id = case when p ? 'group_id' then (select g.id from public.groups g where g.id = nullif(p->>'group_id', '')::uuid and g.club_id = private.my_club()) else group_id end,
    previous_club = case when p ? 'previous_club' then nullif(trim(p->>'previous_club'), '') else previous_club end,
    position = case when p ? 'position' then nullif(p->>'position', '') else position end,
    notes = case when p ? 'notes' then nullif(trim(p->>'notes'), '') else notes end,
    parent_name = coalesce(nullif(trim(p->>'parent_name'), ''), parent_name),
    parent_email = case when p ? 'parent_email' then nullif(lower(trim(p->>'parent_email')), '') else parent_email end,
    parent_phone = case when p ? 'parent_phone' then nullif(regexp_replace(coalesce(p->>'parent_phone', ''), '[^0-9+]', '', 'g'), '') else parent_phone end,
    updated_at = now()
  where id = p_id and club_id = private.my_club() and status not in ('enrolled');
  if not found then raise exception 'Cererea nu a fost găsită.' using errcode = 'P0002'; end if;
end $$;

/** Proba: pe un antrenament (sau meci amical) al echipei, viitor. Antrenorii echipei sunt anunțați. */
create or replace function public.book_trial(p_id uuid, p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_r record; v_ev record; v_coach uuid;
begin
  if not private.can_manage_enrolment() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  select * into v_r from public.enrolment_requests where id = p_id and club_id = private.my_club() for update;
  if not found then raise exception 'Cererea nu a fost găsită.' using errcode = 'P0002'; end if;
  if v_r.status not in ('new', 'trial', 'trial_done') then raise exception 'Cererea e închisă.' using errcode = '22023'; end if;
  select e.* into v_ev from public.events e where e.id = p_event and e.club_id = v_r.club_id and e.deleted_at is null and e.status <> 'cancelled' and e.starts_at > now();
  if not found then raise exception 'Alege un antrenament viitor.' using errcode = '22023'; end if;
  update public.enrolment_requests set status = 'trial', trial_event_id = p_event, trial_at = v_ev.starts_at,
    group_id = coalesce((select et.group_id from public.event_teams et where et.event_id = p_event order by (et.group_id = v_r.group_id) desc limit 1), group_id),
    updated_at = now()
  where id = p_id;
  perform private.enrolment_log(p_id, 'trial_booked', to_char(v_ev.starts_at at time zone 'Europe/Bucharest', 'DD.MM.YYYY HH24:MI'));
  for v_coach in select distinct sg.user_id from public.staff_groups sg join public.event_teams et on et.group_id = sg.group_id and et.event_id = p_event
                 join public.profiles pr on pr.id = sg.user_id and pr.is_active and pr.role = 'coach' loop
    perform private.notify(v_coach, 'enrolment', 'Probă: ' || v_r.child_name,
      to_char(v_ev.starts_at at time zone 'Europe/Bucharest', 'DD.MM HH24:MI') || ' · născut în ' || extract(year from v_r.birth_date),
      '/program/' || p_event, 'trial:' || p_id || ':' || p_event);
  end loop;
end $$;

/** Probele la care participă echipele mele (pentru antrenor): fără datele de contact ale familiei. */
create or replace function public.my_trials(p_event uuid default null)
returns table (id uuid, child_name text, birth_year int, pos text, previous_club text, event_id uuid, trial_at timestamptz,
               status text, trial_rating smallint, trial_note text)
language sql stable security definer set search_path = '' as $$
  select r.id, r.child_name, extract(year from r.birth_date)::int, r.position, r.previous_club, r.trial_event_id, r.trial_at,
         r.status, r.trial_rating, r.trial_note
  from public.enrolment_requests r
  where r.club_id = private.my_club() and r.status in ('trial', 'trial_done') and r.trial_event_id is not null
    and (p_event is null or r.trial_event_id = p_event)
    and (private.can_manage_enrolment()
         or exists (select 1 from public.event_teams et where et.event_id = r.trial_event_id and et.group_id = any (private.my_group_ids())))
  order by r.trial_at
$$;

/** Rezultatul probei: antrenorul echipei sau biroul. */
create or replace function public.record_trial(p_id uuid, p_rating smallint, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_r record;
begin
  select * into v_r from public.enrolment_requests where id = p_id and club_id = private.my_club() for update;
  if not found then raise exception 'Cererea nu a fost găsită.' using errcode = 'P0002'; end if;
  if not (private.can_manage_enrolment()
          or exists (select 1 from public.event_teams et where et.event_id = v_r.trial_event_id and et.group_id = any (private.my_group_ids()))) then
    raise exception 'Acces interzis' using errcode = '42501';
  end if;
  if v_r.status not in ('trial', 'trial_done') then raise exception 'Proba nu e programată.' using errcode = '22023'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Alege o notă de la 1 la 5.' using errcode = '22023'; end if;
  update public.enrolment_requests set status = 'trial_done', trial_rating = p_rating, trial_note = nullif(trim(p_note), ''), updated_at = now() where id = p_id;
  perform private.enrolment_log(p_id, 'trial_done', p_rating || '/5' || coalesce(' · ' || nullif(trim(p_note), ''), ''));
  perform private.notify_users(v_r.club_id, array['admin', 'secretary', 'sporting_director']::public.app_role[], 'enrolment',
    'Probă notată: ' || v_r.child_name, p_rating || '/5', '/club/inscrieri/' || p_id, 'trial_done:' || p_id, app_auth.uid());
end $$;

create or replace function public.decline_enrolment(p_id uuid, p_reason text, p_withdrawn boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_enrolment() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  update public.enrolment_requests set status = case when p_withdrawn then 'withdrawn' else 'declined' end,
    decline_reason = nullif(trim(p_reason), ''), updated_at = now()
  where id = p_id and club_id = private.my_club() and status in ('new', 'trial', 'trial_done');
  if not found then raise exception 'Cererea nu mai poate fi închisă.' using errcode = '22023'; end if;
  perform private.enrolment_log(p_id, case when p_withdrawn then 'withdrawn' else 'declined' end, p_reason);
end $$;

create or replace function public.reopen_enrolment(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_enrolment() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  update public.enrolment_requests set status = case when trial_rating is not null then 'trial_done' when trial_event_id is not null then 'trial' else 'new' end,
    decline_reason = null, updated_at = now()
  where id = p_id and club_id = private.my_club() and status in ('declined', 'withdrawn');
  if not found then raise exception 'Cererea nu poate fi redeschisă.' using errcode = '22023'; end if;
  perform private.enrolment_log(p_id, 'reopened');
end $$;

create or replace function public.note_enrolment(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_enrolment() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  if nullif(trim(p_note), '') is null then raise exception 'Scrie nota.' using errcode = '22023'; end if;
  if not exists (select 1 from public.enrolment_requests where id = p_id and club_id = private.my_club()) then
    raise exception 'Cererea nu a fost găsită.' using errcode = 'P0002';
  end if;
  perform private.enrolment_log(p_id, 'note', trim(p_note));
end $$;

/**
 * Înscrierea: creează jucătorul în echipa aleasă, leagă (sau creează) părintele ca plătitor, emite taxa lunii
 * curente (dacă are plan de taxă) și, opțional, o taxă de înscriere. Contul părintelui și contractul se trimit
 * din aplicație după (au nevoie de e-mail / cont).
 *   p = { group_id, display_name?, first_month: bool, enrol_fee: bigint (bani) | 0 }
 */
create or replace function public.enrol_request(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_r record; v_club uuid := private.my_club(); v_group uuid := nullif(p->>'group_id', '')::uuid; v_player uuid; v_guardian uuid;
  v_parts text[]; v_display text; v_today date := private.club_today(); v_period date := date_trunc('month', private.club_today())::date;
  v_fee bigint; v_fs record; v_charges int := 0; v_enrol_fee bigint := coalesce((p->>'enrol_fee')::bigint, 0);
begin
  if not private.can_manage_enrolment() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  select * into v_r from public.enrolment_requests where id = p_id and club_id = v_club for update;
  if not found then raise exception 'Cererea nu a fost găsită.' using errcode = 'P0002'; end if;
  if v_r.status in ('enrolled', 'declined', 'withdrawn') then raise exception 'Cererea e închisă.' using errcode = '22023'; end if;
  if v_group is null or not exists (select 1 from public.groups g where g.id = v_group and g.club_id = v_club and g.is_active) then
    raise exception 'Alege echipa.' using errcode = '22023';
  end if;
  if v_enrol_fee < 0 or v_enrol_fee > 100000000 then raise exception 'Taxa de înscriere nu e validă.' using errcode = '22023'; end if;

  v_parts := regexp_split_to_array(trim(v_r.child_name), '\s+');
  v_display := coalesce(nullif(trim(p->>'display_name'), ''),
    case when array_length(v_parts, 1) >= 2 then upper(v_parts[1]) || ' ' || upper(left(v_parts[2], 1)) || '.' else upper(v_r.child_name) end);
  insert into public.players (club_id, group_id, full_name, display_name, birth_date, position, enrolled_on, is_active, photo_consent)
  values (v_club, v_group, trim(v_r.child_name), left(v_display, 60), v_r.birth_date, v_r.position, v_today, true, false)
  returning id into v_player;

  -- părintele: aceeași adresă de e-mail în club → aceeași fișă (frați); altfel fișă nouă
  if v_r.parent_email is not null then
    select g.id into v_guardian from public.guardians g
    where g.club_id = v_club and g.deleted_at is null and lower(g.email) = v_r.parent_email order by g.created_at limit 1;
  end if;
  if v_guardian is null then
    insert into public.guardians (club_id, full_name, email, phone) values (v_club, v_r.parent_name, v_r.parent_email, v_r.parent_phone)
    returning id into v_guardian;
  end if;
  insert into public.guardian_players (guardian_id, player_id, relation, is_billing)
  values (v_guardian, v_player, v_r.relation, true) on conflict (guardian_id, player_id) do update set is_billing = true;

  select * into v_fs from public.finance_settings where club_id = v_club;
  -- (un record e „not null” doar dacă toate câmpurile au valori; se testează FOUND)
  if coalesce((p->>'first_month')::boolean, false) and found then
    v_fee := private.effective_fee(v_player, v_period);
    if coalesce(v_fee, 0) > 0 then
      insert into public.charges (club_id, player_id, guardian_id, kind, period, title, amount, due_on, created_by)
      values (v_club, v_player, v_guardian, 'monthly', v_period, 'Taxă lunară ' || private.month_ro(v_period), v_fee,
              greatest(v_today + 7, make_date(extract(year from v_period)::int, extract(month from v_period)::int, v_fs.due_day)), app_auth.uid())
      on conflict do nothing;
      v_charges := v_charges + 1;
    end if;
  end if;
  if v_enrol_fee > 0 then
    insert into public.charges (club_id, player_id, guardian_id, kind, title, amount, due_on, created_by)
    values (v_club, v_player, v_guardian, 'one_off', 'Taxă de înscriere', v_enrol_fee, v_today + 7, app_auth.uid());
    v_charges := v_charges + 1;
  end if;

  update public.enrolment_requests set status = 'enrolled', player_id = v_player, guardian_id = v_guardian, group_id = v_group, updated_at = now()
  where id = p_id;
  perform private.enrolment_log(p_id, 'enrolled', (select name from public.groups where id = v_group));
  return jsonb_build_object('player_id', v_player, 'guardian_id', v_guardian, 'charges', v_charges);
end $$;

grant execute on function public.create_enrolment_request(jsonb), public.update_enrolment_request(uuid, jsonb), public.book_trial(uuid, uuid),
  public.my_trials(uuid), public.record_trial(uuid, smallint, text), public.decline_enrolment(uuid, text, boolean),
  public.reopen_enrolment(uuid), public.note_enrolment(uuid, text), public.enrol_request(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Paginile publice ale clubului: date minime, fără autentificare
-- ---------------------------------------------------------------------------
/** Ce arată antetul public și formularul de înscriere: nume, culori, echipe (nume și ani), setările site-ului. */
create or replace function public.public_club(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'name', c.name, 'short_name', c.short_name, 'has_logo', c.logo_path is not null,
    'primary_color', c.primary_color, 'accent_color', c.accent_color,
    'site', coalesce(c.settings->'site', '{}'::jsonb),
    'groups', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'from', g.birth_year_from, 'to', g.birth_year_to) order by g.sort)
                        from public.groups g where g.club_id = c.id and g.is_active), '[]'::jsonb))
  from public.clubs c where c.slug = lower(trim(p_slug))
$$;
grant execute on function public.public_club(text) to anon, authenticated;

/** Sigla clubului, pentru antetul public (singurul fișier „branding" servit fără sesiune). */
create or replace function public.public_logo_path(p_slug text) returns text
language sql stable security definer set search_path = '' as $$
  select c.logo_path from public.clubs c where c.slug = lower(trim(p_slug))
$$;
grant execute on function public.public_logo_path(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- GDPR: cererea de înscriere a unui jucător șters se golește odată cu el
-- ---------------------------------------------------------------------------
do $$
declare v_src text;
begin
  select pg_get_functiondef('private.scrub_player_lr(uuid, text)'::regprocedure) into v_src;
  if position('enrolment_requests' in v_src) = 0 then
    v_src := regexp_replace(v_src, E'\nend;?\\s*\\$[a-z_]*\\$\\s*$',
      E'\n  update public.enrolment_requests set child_name = ''Jucător șters'', parent_name = ''—'', parent_email = null, parent_phone = ''0000000'', notes = null, trial_note = null, previous_club = null\n  where player_id = p_player;\nend;\n$function$\n');
    if position('enrolment_requests' in v_src) = 0 then raise exception 'scrub_player_lr: punctul de inserare nu a fost găsit'; end if;
    execute v_src;
  end if;
end $$;

/** Cererile închise (refuzate, retrase) se șterg după 12 luni; cele noi uitate, după 18. Rulează din sarcina zilnică. */
create or replace function public.purge_enrolment_requests() returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  if app_auth.role() <> 'service_role' then raise exception 'Doar sarcina programată.' using errcode = '42501'; end if;
  delete from public.enrolment_requests
  where (status in ('declined', 'withdrawn') and updated_at < now() - interval '12 months')
     or (status in ('new', 'trial', 'trial_done') and updated_at < now() - interval '18 months');
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.purge_enrolment_requests() from public, anon, authenticated;
grant execute on function public.purge_enrolment_requests() to service_role;

/** Taxa lunară a unei echipe în luna curentă (pentru dialogul de înscriere). */
create or replace function public.group_fee_now(p_group uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select fp.amount from public.fee_plans fp
  where private.can_manage_enrolment() and fp.group_id = p_group and fp.club_id = private.my_club() and fp.deleted_at is null
    and fp.valid_from <= date_trunc('month', private.club_today())::date
    and (fp.valid_to is null or fp.valid_to >= date_trunc('month', private.club_today())::date)
  order by fp.valid_from desc, fp.created_at desc limit 1
$$;
grant execute on function public.group_fee_now(uuid) to authenticated;
