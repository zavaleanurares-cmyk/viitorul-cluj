-- Locker Room · Faza 4 · Club: tabere (înscriere, plată, participanți).
--
-- Copiii clubului se înscriu din aplicație (părintele sau jucătorul adult): locul se confirmă pe loc dacă mai sunt
-- locuri, iar taxa intră în registrul de taxe al familiei (kind 'camp'). Când tabăra e plină, înscrierea intră pe
-- lista de așteptare și urcă automat când se eliberează un loc.
-- Copiii din afara clubului se înscriu de pe site; biroul confirmă și încasează (numerar / transfer) direct pe înscriere.
-- Informațiile pentru organizatori (de exemplu alergii) le văd doar biroul și cine a înscris copilul;
-- se șterg la 30 de zile după tabără.

create table public.camps (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references public.clubs(id) on delete cascade,
  title            text not null check (length(title) between 2 and 120),
  description      text check (length(description) <= 4000),
  location         text check (length(location) <= 200),
  starts_on        date not null,
  ends_on          date not null,
  price            bigint not null default 0 check (price between 0 and 100000000),
  capacity         int not null check (capacity between 1 and 2000),
  birth_year_from  smallint check (birth_year_from between 1950 and 2100),
  birth_year_to    smallint check (birth_year_to between 1950 and 2100),
  deadline         date,
  status           text not null default 'draft' check (status in ('draft', 'open', 'closed', 'cancelled')),
  is_public        boolean not null default true,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (birth_year_to is null or birth_year_from is null or birth_year_to >= birth_year_from)
);
create index camps_club_idx on public.camps (club_id, starts_on desc);

create table public.camp_registrations (
  id             uuid primary key default gen_random_uuid(),
  camp_id        uuid not null references public.camps(id) on delete cascade,
  club_id        uuid not null references public.clubs(id) on delete cascade,
  player_id      uuid references public.players(id) on delete set null,
  child_name     text not null check (length(child_name) between 3 and 120),
  birth_date     date,
  parent_name    text check (length(parent_name) <= 120),
  parent_email   text check (parent_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  parent_phone   text check (length(parent_phone) between 6 and 20),
  notes          text check (length(notes) <= 1000),
  status         text not null default 'pending' check (status in ('pending', 'confirmed', 'waitlist', 'cancelled')),
  source         text not null check (source in ('family', 'public', 'office')),
  charge_id      uuid references public.charges(id) on delete set null,
  paid_external  boolean not null default false,
  paid_note      text check (length(paid_note) <= 200),
  cancel_reason  text check (length(cancel_reason) <= 500),
  registered_by  uuid references public.profiles(id) on delete set null,
  consent_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index camp_registrations_camp_idx on public.camp_registrations (camp_id, status, created_at);
create unique index camp_registrations_player_uq on public.camp_registrations (camp_id, player_id) where player_id is not null and status <> 'cancelled';

create or replace function private.can_manage_camps() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.my_role()) in ('admin', 'secretary'), false)
$$;
grant execute on function private.can_manage_camps() to authenticated;

alter table public.camps enable row level security;
alter table public.camp_registrations enable row level security;
-- taberele deschise le vede oricine din club (familii, staff); ciornele, doar biroul
create policy camps_select on public.camps for select to authenticated
  using (club_id = (select private.my_club()) and (status in ('open', 'closed') or (select private.can_manage_camps())));
create policy camp_registrations_select on public.camp_registrations for select to authenticated
  using (club_id = (select private.my_club()) and ((select private.can_manage_camps()) or registered_by = (select app_auth.uid())
         or player_id = any (private.my_player_ids())));
grant select on public.camps, public.camp_registrations to authenticated;

create or replace function private.camp_taken(p_camp uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.camp_registrations where camp_id = p_camp and status = 'confirmed'
$$;

-- p = { id?, title, description?, location?, starts_on, ends_on, price, capacity, birth_year_from?, birth_year_to?, deadline?, status, is_public }
create or replace function public.save_camp(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := nullif(p->>'id', '')::uuid; v_old record;
begin
  if not private.can_manage_camps() then raise exception 'Doar biroul organizează tabere.' using errcode = '42501'; end if;
  if (p->>'capacity')::int is null or (p->>'starts_on')::date is null or (p->>'ends_on')::date is null then
    raise exception 'Completează datele și numărul de locuri.' using errcode = '22023';
  end if;
  if v_id is null then
    insert into public.camps (club_id, title, description, location, starts_on, ends_on, price, capacity, birth_year_from, birth_year_to, deadline, status, is_public, created_by)
    values (private.my_club(), trim(p->>'title'), nullif(trim(p->>'description'), ''), nullif(trim(p->>'location'), ''),
      (p->>'starts_on')::date, (p->>'ends_on')::date, coalesce((p->>'price')::bigint, 0), (p->>'capacity')::int,
      nullif(p->>'birth_year_from', '')::smallint, nullif(p->>'birth_year_to', '')::smallint, nullif(p->>'deadline', '')::date,
      coalesce(nullif(p->>'status', ''), 'draft'), coalesce((p->>'is_public')::boolean, true), app_auth.uid())
    returning id into v_id;
  else
    select * into v_old from public.camps where id = v_id and club_id = private.my_club() for update;
    if not found then raise exception 'Tabăra nu a fost găsită.' using errcode = 'P0002'; end if;
    if (p->>'capacity')::int < private.camp_taken(v_id) then
      raise exception 'Sunt deja % locuri confirmate; nu poți scădea sub acest număr.', private.camp_taken(v_id) using errcode = '22023';
    end if;
    if v_old.price <> coalesce((p->>'price')::bigint, 0) and exists (select 1 from public.camp_registrations where camp_id = v_id and status = 'confirmed') then
      raise exception 'Prețul nu se mai schimbă după primele înscrieri confirmate.' using errcode = '22023';
    end if;
    update public.camps set title = trim(p->>'title'), description = nullif(trim(p->>'description'), ''), location = nullif(trim(p->>'location'), ''),
      starts_on = (p->>'starts_on')::date, ends_on = (p->>'ends_on')::date, price = coalesce((p->>'price')::bigint, 0), capacity = (p->>'capacity')::int,
      birth_year_from = nullif(p->>'birth_year_from', '')::smallint, birth_year_to = nullif(p->>'birth_year_to', '')::smallint,
      deadline = nullif(p->>'deadline', '')::date, status = coalesce(nullif(p->>'status', ''), status), is_public = coalesce((p->>'is_public')::boolean, is_public)
    where id = v_id;
    perform private.promote_camp_waitlist(v_id);
  end if;
  return v_id;
end $$;

/** Confirmă înscrierea: locul și, pentru copiii clubului, taxa în registrul familiei. */
create or replace function private.confirm_camp_spot(p_reg uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_r record; v_c record; v_g uuid; v_charge uuid; v_user uuid;
begin
  select * into v_r from public.camp_registrations where id = p_reg for update;
  select * into v_c from public.camps where id = v_r.camp_id;
  if v_r.player_id is not null and v_c.price > 0 and v_r.charge_id is null then
    v_g := private.billing_guardian(v_r.player_id);
    insert into public.charges (club_id, player_id, guardian_id, kind, title, amount, due_on, created_by)
    values (v_c.club_id, v_r.player_id, v_g, 'camp', 'Tabără: ' || v_c.title, v_c.price,
            greatest(least(v_c.starts_on, private.club_today(v_c.club_id) + 7), private.club_today(v_c.club_id)), app_auth.uid())
    returning id into v_charge;
  end if;
  update public.camp_registrations set status = 'confirmed', charge_id = coalesce(v_charge, charge_id), updated_at = now() where id = p_reg;
  v_user := coalesce(v_r.registered_by, (select pl.user_id from public.players pl where pl.id = v_r.player_id));
  if v_user is not null then
    perform private.notify(v_user, 'camp', 'Loc confirmat: ' || v_c.title, v_r.child_name || ' · ' || to_char(v_c.starts_on, 'DD.MM') || '–' || to_char(v_c.ends_on, 'DD.MM.YYYY'),
      '/tabere', 'camp_confirmed:' || p_reg);
  end if;
end $$;

/** Urcă de pe lista de așteptare cât timp sunt locuri (în ordinea înscrierii). */
create or replace function private.promote_camp_waitlist(p_camp uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare v_c record; v_r record; v_n int := 0;
begin
  select * into v_c from public.camps where id = p_camp;
  if v_c.status not in ('open', 'closed') then return 0; end if;
  for v_r in select id from public.camp_registrations where camp_id = p_camp and status = 'waitlist' order by created_at loop
    exit when private.camp_taken(p_camp) >= v_c.capacity;
    perform private.confirm_camp_spot(v_r.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

/** Eligibilitate după anul nașterii (dacă tabăra are interval). */
create or replace function private.camp_age_ok(p_camp uuid, p_birth date) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_birth is null or (
    (c.birth_year_from is null or extract(year from p_birth) >= c.birth_year_from)
    and (c.birth_year_to is null or extract(year from p_birth) <= c.birth_year_to))
  from public.camps c where c.id = p_camp
$$;

create or replace function private.camp_open_for(p_camp uuid, p_club uuid) returns record
language plpgsql stable security definer set search_path = '' as $$
declare v_c record;
begin
  select * into v_c from public.camps where id = p_camp and club_id = p_club;
  if not found then raise exception 'Tabăra nu a fost găsită.' using errcode = 'P0002'; end if;
  if v_c.status <> 'open' then raise exception 'Înscrierile la această tabără sunt închise.' using errcode = '22023'; end if;
  if coalesce(v_c.deadline, v_c.starts_on) < private.club_today(p_club) then
    raise exception 'Termenul de înscriere a trecut.' using errcode = '22023';
  end if;
  return v_c;
end $$;

/** Familia (părintele sau jucătorul adult) înscrie un copil al clubului. Locul se confirmă dacă mai sunt locuri. */
create or replace function public.register_camp(p_camp uuid, p_player uuid, p_notes text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); v_c record; v_pl record; v_id uuid; v_status text;
begin
  if not (p_player = any (private.my_player_ids()) or private.can_manage_camps()) then raise exception 'Acces interzis' using errcode = '42501'; end if;
  v_c := private.camp_open_for(p_camp, v_club);
  select id, full_name, birth_date into v_pl from public.players where id = p_player and club_id = v_club and is_active and anonymized_at is null;
  if not found then raise exception 'Jucătorul nu a fost găsit.' using errcode = 'P0002'; end if;
  if not private.camp_age_ok(p_camp, v_pl.birth_date) then raise exception 'Tabăra este pentru alți ani de naștere.' using errcode = '22023'; end if;
  -- jucătorul minor nu se înscrie singur (taxa e a părintelui)
  if private.my_role() = 'player' and (v_pl.birth_date is null or v_pl.birth_date > private.club_today(v_club) - interval '18 years') then
    raise exception 'Roagă un părinte să te înscrie din contul lui.' using errcode = '42501';
  end if;
  if exists (select 1 from public.camp_registrations where camp_id = p_camp and player_id = p_player and status <> 'cancelled') then
    raise exception 'Copilul este deja înscris.' using errcode = '23505';
  end if;
  v_status := case when private.camp_taken(p_camp) < v_c.capacity then 'pending' else 'waitlist' end;
  insert into public.camp_registrations (camp_id, club_id, player_id, child_name, birth_date, notes, status, source, registered_by)
  values (p_camp, v_club, p_player, v_pl.full_name, v_pl.birth_date, nullif(trim(p_notes), ''), v_status,
          case when private.can_manage_camps() then 'office' else 'family' end, app_auth.uid())
  returning id into v_id;
  if v_status = 'pending' then
    perform private.confirm_camp_spot(v_id);
    v_status := 'confirmed';
  end if;
  perform private.notify_users(v_club, array['admin', 'secretary']::public.app_role[], 'camp',
    'Înscriere la tabără: ' || v_c.title, v_pl.full_name || case when v_status = 'waitlist' then ' (listă de așteptare)' else '' end,
    '/club/tabere/' || p_camp, 'camp_reg:' || v_id, app_auth.uid());
  return v_status;
end $$;

/** Formularul public (copii din afara clubului): înscrierea așteaptă confirmarea biroului. */
create or replace function public.submit_camp_registration(p_slug text, p_camp uuid, p jsonb, p_ip text default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.club_by_slug(p_slug); v_c record; v_id uuid; v_birth date := (p->>'birth_date')::date;
begin
  if v_club is null then raise exception 'Clubul nu a fost găsit.' using errcode = 'P0002'; end if;
  v_c := private.camp_open_for(p_camp, v_club);
  if not v_c.is_public then raise exception 'Tabăra nu a fost găsită.' using errcode = 'P0002'; end if;
  if coalesce((p->>'consent')::boolean, false) is not true then raise exception 'Este nevoie de acordul pentru prelucrarea datelor.' using errcode = '22023'; end if;
  if v_birth is null or not private.camp_age_ok(p_camp, v_birth) then raise exception 'Tabăra este pentru alți ani de naștere.' using errcode = '22023'; end if;
  if nullif(trim(p->>'parent_email'), '') is null and nullif(trim(p->>'parent_phone'), '') is null then
    raise exception 'Scrie un e-mail sau un telefon.' using errcode = '22023';
  end if;
  if not private.public_hit(v_club, 'camp', p_ip, 5, 200) then
    raise exception 'Prea multe trimiteri. Încearcă din nou peste o oră.' using errcode = '54000';
  end if;
  insert into public.camp_registrations (camp_id, club_id, child_name, birth_date, parent_name, parent_email, parent_phone, notes, status, source, consent_at)
  values (p_camp, v_club, trim(p->>'child_name'), v_birth, trim(p->>'parent_name'), nullif(lower(trim(p->>'parent_email')), ''),
          nullif(regexp_replace(coalesce(p->>'parent_phone', ''), '[^0-9+]', '', 'g'), ''), nullif(trim(p->>'notes'), ''),
          'pending', 'public', now())
  returning id into v_id;
  perform private.notify_users(v_club, array['admin', 'secretary']::public.app_role[], 'camp',
    'Înscriere de pe site: ' || v_c.title, trim(p->>'child_name'), '/club/tabere/' || p_camp, 'camp_reg:' || v_id);
  return true;
end $$;
grant execute on function public.submit_camp_registration(text, uuid, jsonb, text) to anon, authenticated;

/** Biroul confirmă o înscriere de pe site (opțional legată de un jucător al clubului → taxa intră în registru). */
create or replace function public.confirm_camp_registration(p_id uuid, p_player uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_r record; v_c record;
begin
  if not private.can_manage_camps() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  select * into v_r from public.camp_registrations where id = p_id and club_id = private.my_club() for update;
  if not found then raise exception 'Înscrierea nu a fost găsită.' using errcode = 'P0002'; end if;
  if v_r.status not in ('pending', 'waitlist') then raise exception 'Înscrierea e deja confirmată sau anulată.' using errcode = '22023'; end if;
  select * into v_c from public.camps where id = v_r.camp_id;
  if private.camp_taken(v_r.camp_id) >= v_c.capacity then raise exception 'Tabăra este plină.' using errcode = '22023'; end if;
  if p_player is not null then
    if not exists (select 1 from public.players where id = p_player and club_id = v_r.club_id) then raise exception 'Jucătorul nu a fost găsit.' using errcode = 'P0002'; end if;
    update public.camp_registrations set player_id = p_player where id = p_id;
  end if;
  perform private.confirm_camp_spot(p_id);
end $$;

create or replace function public.waitlist_camp_registration(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_camps() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  update public.camp_registrations set status = 'waitlist', updated_at = now()
  where id = p_id and club_id = private.my_club() and status = 'pending';
  if not found then raise exception 'Doar înscrierile neconfirmate trec pe lista de așteptare.' using errcode = '22023'; end if;
end $$;

/** Plata încasată direct (numerar, transfer) pentru copiii din afara clubului. */
create or replace function public.set_camp_paid(p_id uuid, p_paid boolean, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_camps() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  update public.camp_registrations set paid_external = p_paid, paid_note = nullif(trim(p_note), ''), updated_at = now()
  where id = p_id and club_id = private.my_club() and charge_id is null;
  if not found then raise exception 'Plata acestei înscrieri trece prin registrul de taxe.' using errcode = '22023'; end if;
end $$;

/**
 * Anularea: biroul oricând; familia până la începerea taberei. Taxa neplătită se anulează; cea plătită rămâne
 * și contabilul e anunțat pentru restituire. Locul eliberat urcă primul de pe lista de așteptare.
 */
create or replace function public.cancel_camp_registration(p_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_r record; v_c record; v_paid boolean := false;
begin
  select * into v_r from public.camp_registrations where id = p_id and club_id = private.my_club() for update;
  if not found then raise exception 'Înscrierea nu a fost găsită.' using errcode = 'P0002'; end if;
  select * into v_c from public.camps where id = v_r.camp_id;
  if not private.can_manage_camps() then
    if not (v_r.registered_by = app_auth.uid() or v_r.player_id = any (private.my_player_ids())) then raise exception 'Acces interzis' using errcode = '42501'; end if;
    if v_c.starts_on <= private.club_today(v_r.club_id) then raise exception 'Tabăra a început; anunță biroul clubului.' using errcode = '22023'; end if;
  end if;
  if v_r.status = 'cancelled' then return; end if;
  if v_r.charge_id is not null then
    v_paid := exists (select 1 from public.allocations a where a.charge_id = v_r.charge_id);
    if not v_paid then
      update public.charges set status = 'cancelled', cancel_reason = 'Înscriere la tabără anulată' where id = v_r.charge_id and status = 'open';
    else
      perform private.notify_users(v_r.club_id, array['accountant', 'admin']::public.app_role[], 'camp',
        'Restituire de verificat: ' || v_c.title, v_r.child_name || ' a renunțat după plată.', '/bani', 'camp_refund:' || p_id);
    end if;
  end if;
  update public.camp_registrations set status = 'cancelled', cancel_reason = nullif(trim(p_reason), ''), updated_at = now() where id = p_id;
  perform private.promote_camp_waitlist(v_r.camp_id);
end $$;

grant execute on function public.save_camp(jsonb), public.register_camp(uuid, uuid, text), public.confirm_camp_registration(uuid, uuid),
  public.waitlist_camp_registration(uuid), public.set_camp_paid(uuid, boolean, text), public.cancel_camp_registration(uuid, text) to authenticated;

/** Taberele publice deschise, cu locurile rămase (fără nume). */
create or replace function public.public_camps(p_slug text)
returns table (id uuid, title text, description text, location text, starts_on date, ends_on date, price bigint,
               birth_year_from smallint, birth_year_to smallint, deadline date, spots_left int)
language sql stable security definer set search_path = '' as $$
  select c.id, c.title, c.description, c.location, c.starts_on, c.ends_on, c.price, c.birth_year_from, c.birth_year_to, c.deadline,
         greatest(c.capacity - private.camp_taken(c.id), 0)
  from public.camps c
  where c.club_id = private.club_by_slug(p_slug) and c.is_public and c.status = 'open'
    and coalesce(c.deadline, c.starts_on) >= private.club_today(c.club_id)
  order by c.starts_on
$$;
grant execute on function public.public_camps(text) to anon, authenticated;

/** Locuri ocupate pe tabără, pentru familie (fără nume). */
create or replace function public.camp_spots(p_camp uuid) returns int
language sql stable security definer set search_path = '' as $$
  select greatest(c.capacity - private.camp_taken(c.id), 0) from public.camps c where c.id = p_camp and c.club_id = private.my_club()
$$;
grant execute on function public.camp_spots(uuid) to authenticated;

/** Notele pentru organizatori și datele de contact ale copiilor din afară se șterg la 30 de zile după tabără. */
create or replace function public.purge_camp_data() returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  if app_auth.role() <> 'service_role' then raise exception 'Doar sarcina programată.' using errcode = '42501'; end if;
  update public.camp_registrations r set notes = null,
    parent_email = case when r.player_id is null then null else r.parent_email end,
    parent_phone = case when r.player_id is null then null else r.parent_phone end
  from public.camps c
  where c.id = r.camp_id and c.ends_on < current_date - 30 and (r.notes is not null or (r.player_id is null and (r.parent_email is not null or r.parent_phone is not null)));
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.purge_camp_data() from public, anon, authenticated;
grant execute on function public.purge_camp_data() to service_role;

-- GDPR: înscrierile unui jucător șters rămân fără nume și note
do $$
declare v_src text;
begin
  select pg_get_functiondef('private.scrub_player_lr(uuid, text)'::regprocedure) into v_src;
  if position('camp_registrations' in v_src) = 0 then
    v_src := regexp_replace(v_src, E'\nend;?\\s*\\$[a-z_]*\\$\\s*$',
      E'\n  update public.camp_registrations set child_name = ''Jucător șters'', notes = null, parent_name = null, parent_email = null, parent_phone = null\n  where player_id = p_player;\nend;\n$function$\n');
    if position('camp_registrations' in v_src) = 0 then raise exception 'scrub_player_lr: punctul de inserare nu a fost găsit'; end if;
    execute v_src;
  end if;
end $$;
