-- =============================================================================
-- Locker Room · 2 · Lot și program (faza 2)
--
--   memberships            un cont poate avea roluri în mai multe cluburi
--   seasons                sezoanele clubului
--   groups (= echipe)      + sezon, program, ani de naștere, gen, format, minute pe repriză
--   players                + cetățenie, legitimație, ID FIFA, data înscrierii, acord foto
--   guardians              părinții și tutorii, legați de unul sau mai mulți copii
--   venues                 terenuri (proprii sau în deplasare), cu sub-terenuri
--   event_series / events  antrenament, meci, rezervare, ședință: o singură entitate
--   event_teams            ce echipe participă la un eveniment
--   attendance             prezența, salvată și offline (ultima scriere câștigă după ora din telefon)
--   competitions, opponents, matches, match_squad, match_events, suspensions, competition_standings
--
-- Scrierile cu reguli (evenimente, prezență, meci) trec prin RPC-uri SECURITY DEFINER cu verificări
-- explicite; tabelele au RLS pentru citire și pentru scrierile directe ale biroului.
-- =============================================================================

-- Funcțiile de mai jos se referă la tabele create mai târziu în același fișier.
set local check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Funcții ajutătoare
-- ---------------------------------------------------------------------------
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.my_role()) in ('admin', 'physio'), false)
$$;

-- Biroul: cine administrează lotul și programul.
create or replace function private.is_office() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.my_role()) in ('admin', 'secretary', 'sporting_director', 'physio'), false)
$$;

create or replace function private.is_club_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.my_role()) in
    ('admin', 'secretary', 'sporting_director', 'physio', 'coach', 'accountant', 'owner'), false)
$$;

-- Jucătorii „mei": eu ca jucător sau copiii mei ca părinte.
create or replace function private.my_player_ids() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct x.id), '{}'::uuid[]) from (
    select pl.id from public.players pl
    where pl.user_id = (select app_auth.uid()) and pl.club_id = (select private.my_club())
    union
    select gp.player_id from public.guardian_players gp
    join public.guardians g on g.id = gp.guardian_id
    where g.user_id = (select app_auth.uid()) and g.club_id = (select private.my_club()) and g.deleted_at is null
  ) x
$$;

create or replace function private.my_family_group_ids() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct pl.group_id) filter (where pl.group_id is not null), '{}'::uuid[])
  from public.players pl where pl.id = any ((select private.my_player_ids())::uuid[])
$$;

-- Echipa e vizibilă pentru mine ca staff (birou: toate; antrenor: ale lui).
create or replace function private.can_see_team(p_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.groups g
    where g.id = p_group and g.club_id = (select private.my_club())
      and ((select private.is_office())
           or (select private.my_role()) in ('owner', 'accountant')
           or ((select private.my_role()) = 'coach' and g.id = any ((select private.my_group_ids())::uuid[])))
  )
$$;

-- ---------------------------------------------------------------------------
-- Conturi în mai multe cluburi
-- ---------------------------------------------------------------------------
create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references app_auth.users(id) on delete cascade,
  club_id     uuid not null references public.clubs(id) on delete cascade,
  role        public.app_role not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (user_id, club_id, role)
);
create index memberships_user_idx on public.memberships (user_id) where is_active;

insert into public.memberships (user_id, club_id, role, is_active)
select p.id, p.club_id, p.role, p.is_active from public.profiles p
on conflict do nothing;

-- Profilul rămâne „contextul curent" (clubul și rolul cu care lucrează acum utilizatorul);
-- schimbarea clubului îl rescrie din membership. Așa toate politicile existente rămân valabile.
create or replace function private.profiles_sync_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.memberships (user_id, club_id, role, is_active)
  values (new.id, new.club_id, new.role, new.is_active)
  on conflict (user_id, club_id, role) do update set is_active = excluded.is_active;
  return new;
end $$;
create trigger profiles_sync_membership after insert or update of club_id, role, is_active on public.profiles
  for each row execute function private.profiles_sync_membership();

-- ---------------------------------------------------------------------------
-- Sezoane, echipe, jucători
-- ---------------------------------------------------------------------------
create table public.seasons (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  name        text not null,
  starts_on   date not null,
  ends_on     date not null,
  is_current  boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (club_id, name),
  check (ends_on > starts_on)
);
create unique index seasons_current_uq on public.seasons (club_id) where is_current;

insert into public.seasons (club_id, name, starts_on, ends_on, is_current)
select c.id, '2026–2027', date '2026-07-01', date '2027-06-30', true from public.clubs c
on conflict do nothing;

alter table public.groups
  add column season_id        uuid references public.seasons(id) on delete set null,
  add column programme        text,               -- ex. Elite, AJF, Feminin
  add column birth_year_from  smallint check (birth_year_from between 1950 and 2100),
  add column birth_year_to    smallint check (birth_year_to between 1950 and 2100),
  add column gender           text check (gender in ('m', 'f', 'mixed')),
  add column players_on_pitch smallint check (players_on_pitch between 4 and 11),
  add column half_minutes     smallint check (half_minutes between 5 and 60),
  add column color            text;

update public.groups g set season_id = s.id from public.seasons s where s.club_id = g.club_id and s.is_current;

alter table public.players
  add column nationality          text,
  add column registration_number  text,           -- legitimația
  add column fifa_id              text,
  add column enrolled_on          date,
  add column photo_consent        boolean not null default false;

-- ---------------------------------------------------------------------------
-- Părinți și tutori
-- ---------------------------------------------------------------------------
create table public.guardians (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  user_id     uuid references app_auth.users(id) on delete set null,
  full_name   text not null,
  phone       text,
  email       text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index guardians_club_idx on public.guardians (club_id) where deleted_at is null;
create index guardians_user_idx on public.guardians (user_id);

create table public.guardian_players (
  guardian_id  uuid not null references public.guardians(id) on delete cascade,
  player_id    uuid not null references public.players(id) on delete cascade,
  relation     text not null default 'parent' check (relation in ('mother', 'father', 'parent', 'guardian', 'other')),
  is_billing   boolean not null default false,  -- primește taxele (faza 3)
  is_emergency boolean not null default true,
  primary key (guardian_id, player_id)
);
create index guardian_players_player_idx on public.guardian_players (player_id);

-- Mutăm părinții din player_contacts (câmpurile vechi rămân, doar pentru compatibilitate).
do $$
declare r record; v_id uuid;
begin
  for r in
    select pc.player_id, pl.club_id, pc.guardian_name, pc.guardian_phone, pc.guardian_email
    from public.player_contacts pc join public.players pl on pl.id = pc.player_id
    where coalesce(trim(pc.guardian_name), '') <> ''
  loop
    insert into public.guardians (club_id, full_name, phone, email)
    values (r.club_id, trim(r.guardian_name), nullif(trim(r.guardian_phone), ''), nullif(trim(r.guardian_email), ''))
    returning id into v_id;
    insert into public.guardian_players (guardian_id, player_id, is_billing) values (v_id, r.player_id, true);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Terenuri și evenimente
-- ---------------------------------------------------------------------------
create table public.venues (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  parent_id   uuid references public.venues(id) on delete cascade,  -- sub-teren (ex. jumătate de teren)
  name        text not null,
  is_own      boolean not null default true,
  address     text,
  surface     text check (surface in ('natural', 'synthetic', 'indoor', 'other')),
  has_lights  boolean not null default false,
  is_active   boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  unique (club_id, name)
);

create table public.event_series (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  kind          text not null check (kind in ('training', 'match', 'booking', 'meeting', 'other')),
  title         text not null,
  weekdays      smallint[] not null check (weekdays <@ array[1,2,3,4,5,6,7]::smallint[] and cardinality(weekdays) > 0),
  start_time    time not null,
  duration_min  int not null check (duration_min between 5 and 600),
  venue_id      uuid references public.venues(id) on delete set null,
  starts_on     date not null,
  until         date not null,
  skip_dates    date[] not null default '{}',
  group_ids     uuid[] not null default '{}',
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  check (until >= starts_on and until <= starts_on + 400)
);

create table public.events (
  id                    uuid primary key default gen_random_uuid(),
  club_id               uuid not null references public.clubs(id) on delete cascade,
  kind                  text not null check (kind in ('training', 'match', 'booking', 'meeting', 'other')),
  title                 text not null,
  starts_at             timestamptz not null,
  ends_at               timestamptz not null,
  venue_id              uuid references public.venues(id) on delete set null,
  status                text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'done')),
  series_id             uuid references public.event_series(id) on delete set null,
  notes                 text,
  attendance_saved_at   timestamptz,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  check (ends_at > starts_at)
);
create index events_club_time_idx on public.events (club_id, starts_at) where deleted_at is null;
create index events_series_idx on public.events (series_id);

create table public.event_teams (
  event_id  uuid not null references public.events(id) on delete cascade,
  group_id  uuid not null references public.groups(id) on delete cascade,
  primary key (event_id, group_id)
);
create index event_teams_group_idx on public.event_teams (group_id);

create table public.attendance (
  event_id     uuid not null references public.events(id) on delete cascade,
  player_id    uuid not null references public.players(id) on delete cascade,
  status       text not null check (status in ('present', 'absent', 'late', 'injured')),
  reason       text check (reason in ('sick', 'injured', 'school', 'family', 'unexcused', 'other')),
  note         text,
  recorded_by  uuid references public.profiles(id) on delete set null,
  recorded_at  timestamptz not null default now(),   -- ora din telefon, pentru sincronizarea offline
  synced_at    timestamptz not null default now(),
  primary key (event_id, player_id)
);
create index attendance_player_idx on public.attendance (player_id);

create or replace function private.event_club(p_event uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select e.club_id from public.events e where e.id = p_event
$$;

create or replace function private.event_group_ids(p_event uuid) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(et.group_id), '{}'::uuid[]) from public.event_teams et where et.event_id = p_event
$$;

-- Văd evenimentul: staff-ul clubului (calendarul e comun), jucătorii și părinții echipelor invitate.
create or replace function private.can_see_event(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event and e.club_id = (select private.my_club())
      and ((select private.is_club_staff())
           or (select private.event_group_ids(e.id)) && (select private.my_family_group_ids()))
  )
$$;

-- Conduc evenimentul (prezență, meci): biroul sau antrenorul uneia dintre echipele lui.
create or replace function private.can_run_event(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event and e.club_id = (select private.my_club())
      and ((select private.is_office())
           or ((select private.my_role()) = 'coach'
               and (select private.event_group_ids(e.id)) && (select private.my_group_ids())))
  )
$$;

-- ---------------------------------------------------------------------------
-- Competiții și meciuri
-- ---------------------------------------------------------------------------
create table public.competitions (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  season_id     uuid references public.seasons(id) on delete set null,
  group_id      uuid references public.groups(id) on delete set null,   -- echipa noastră
  name          text not null,
  source        text not null default 'manual' check (source in ('frf', 'ajf', 'amfb', 'manual')),
  external_id   text,
  half_minutes  smallint check (half_minutes between 5 and 60),
  yellow_limit  smallint not null default 3 check (yellow_limit between 1 and 20),  -- galbene până la suspendare
  own_name      text,           -- cum apare echipa noastră în listele federației
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (club_id, name, season_id)
);

create table public.opponents (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  name        text not null,
  short_name  text,
  created_at  timestamptz not null default now(),
  unique (club_id, name)
);

create table public.matches (
  event_id        uuid primary key references public.events(id) on delete cascade,
  competition_id  uuid references public.competitions(id) on delete set null,
  opponent_id     uuid references public.opponents(id) on delete set null,
  round           text,
  is_home         boolean not null default true,
  external_key    text,                       -- cheie de import (competiție + etapă + adversar)
  goals_for       smallint not null default 0,
  goals_against   smallint not null default 0,
  status          text not null default 'scheduled' check (status in ('scheduled', 'live', 'finished')),
  formation       text,
  report          text,
  closed_at       timestamptz,
  closed_by       uuid references public.profiles(id) on delete set null
);
create unique index matches_external_uq on public.matches (competition_id, external_key) where external_key is not null;

create table public.match_squad (
  event_id      uuid not null references public.matches(event_id) on delete cascade,
  player_id     uuid not null references public.players(id) on delete cascade,
  role          text not null check (role in ('starter', 'sub')),
  slot          smallint check (slot between 0 and 10),   -- postul pe teren, în ordinea formației
  is_captain    boolean not null default false,
  minutes       smallint check (minutes between 0 and 150),
  rating        smallint check (rating between 1 and 5),
  primary key (event_id, player_id)
);
create index match_squad_player_idx on public.match_squad (player_id);

create table public.match_events (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references public.matches(event_id) on delete cascade,
  minute             smallint not null check (minute between 0 and 150),
  kind               text not null check (kind in ('goal', 'own_goal', 'goal_against', 'yellow', 'red', 'sub')),
  player_id          uuid references public.players(id) on delete set null,      -- marcator / sancționat / iese
  related_player_id  uuid references public.players(id) on delete set null,      -- pasă decisivă / intră
  note               text,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now()
);
create index match_events_event_idx on public.match_events (event_id, minute);
create index match_events_player_idx on public.match_events (player_id);

create table public.suspensions (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references public.clubs(id) on delete cascade,
  player_id          uuid not null references public.players(id) on delete cascade,
  competition_id     uuid references public.competitions(id) on delete cascade,
  reason             text not null,
  matches_total      smallint not null default 1 check (matches_total between 1 and 50),
  matches_remaining  smallint not null default 1 check (matches_remaining between 0 and 50),
  source_event_id    uuid references public.events(id) on delete set null,
  created_at         timestamptz not null default now()
);
create index suspensions_open_idx on public.suspensions (player_id) where matches_remaining > 0;

create table public.competition_standings (
  competition_id  uuid not null references public.competitions(id) on delete cascade,
  position        smallint not null,
  team_name       text not null,
  played          smallint not null default 0,
  won             smallint not null default 0,
  drawn           smallint not null default 0,
  lost            smallint not null default 0,
  goals_for       smallint not null default 0,
  goals_against   smallint not null default 0,
  points          smallint not null default 0,
  is_own          boolean not null default false,
  updated_at      timestamptz not null default now(),
  primary key (competition_id, position)
);

create or replace function private.competition_club(p_competition uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select c.club_id from public.competitions c where c.id = p_competition
$$;

create or replace function private.guardian_club(p_guardian uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select g.club_id from public.guardians g where g.id = p_guardian
$$;

-- ---------------------------------------------------------------------------
-- Triggere: updated_at, audit
-- ---------------------------------------------------------------------------
create trigger events_touch before update on public.events
  for each row execute function private.touch_updated_at();
create trigger guardians_touch before update on public.guardians
  for each row execute function private.touch_updated_at();

do $$
declare t text;
begin
  foreach t in array array[
    'memberships','seasons','guardians','guardian_players','venues','event_series','events',
    'attendance','competitions','matches','match_squad','match_events','suspensions'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function private.audit()', t || '_audit', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.memberships            enable row level security;
alter table public.seasons                enable row level security;
alter table public.guardians              enable row level security;
alter table public.guardian_players       enable row level security;
alter table public.venues                 enable row level security;
alter table public.event_series           enable row level security;
alter table public.events                 enable row level security;
alter table public.event_teams            enable row level security;
alter table public.attendance             enable row level security;
alter table public.competitions           enable row level security;
alter table public.opponents              enable row level security;
alter table public.matches                enable row level security;
alter table public.match_squad            enable row level security;
alter table public.match_events           enable row level security;
alter table public.suspensions            enable row level security;
alter table public.competition_standings  enable row level security;

grant select, insert, update, delete on
  public.memberships, public.seasons, public.guardians, public.guardian_players, public.venues,
  public.event_series, public.events, public.event_teams, public.attendance, public.competitions,
  public.opponents, public.matches, public.match_squad, public.match_events, public.suspensions,
  public.competition_standings
to authenticated;
grant all on
  public.memberships, public.seasons, public.guardians, public.guardian_players, public.venues,
  public.event_series, public.events, public.event_teams, public.attendance, public.competitions,
  public.opponents, public.matches, public.match_squad, public.match_events, public.suspensions,
  public.competition_standings
to service_role;

-- memberships: îmi văd rolurile; administratorul le vede și le gestionează pe ale clubului.
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = (select app_auth.uid())
      or (club_id = (select private.my_club()) and (select private.is_admin())));
create policy memberships_write on public.memberships for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_admin()))
  with check (club_id = (select private.my_club()) and (select private.is_admin()));

-- seasons, venues, opponents: citire pentru tot clubul, scriere pentru birou.
create policy seasons_select on public.seasons for select to authenticated
  using (club_id = (select private.my_club()));
create policy seasons_write on public.seasons for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_office()))
  with check (club_id = (select private.my_club()) and (select private.is_office()));

create policy venues_select on public.venues for select to authenticated
  using (club_id = (select private.my_club()));
create policy venues_write on public.venues for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_office()))
  with check (club_id = (select private.my_club()) and (select private.is_office()));

create policy opponents_select on public.opponents for select to authenticated
  using (club_id = (select private.my_club()));
create policy opponents_write on public.opponents for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_office()))
  with check (club_id = (select private.my_club()) and (select private.is_office()));

-- guardians: biroul; antrenorul pentru copiii din echipele lui; părintele își vede fișa.
create policy guardians_select on public.guardians for select to authenticated
  using (
    club_id = (select private.my_club())
    and (
      (select private.is_office())
      or user_id = (select app_auth.uid())
      or exists (
        select 1 from public.guardian_players gp join public.players pl on pl.id = gp.player_id
        where gp.guardian_id = guardians.id
          and (select private.my_role()) = 'coach'
          and pl.group_id = any ((select private.my_group_ids())::uuid[])
      )
    )
  );
create policy guardians_write on public.guardians for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_office()))
  with check (club_id = (select private.my_club()) and (select private.is_office()));
create policy guardians_update_self on public.guardians for update to authenticated
  using (user_id = (select app_auth.uid()) and club_id = (select private.my_club()))
  with check (user_id = (select app_auth.uid()) and club_id = (select private.my_club()));

create policy guardian_players_select on public.guardian_players for select to authenticated
  using (
    private.guardian_club(guardian_id) = (select private.my_club())
    and (
      (select private.is_office())
      or player_id = any ((select private.my_player_ids())::uuid[])
      or exists (
        select 1 from public.players pl
        where pl.id = guardian_players.player_id and (select private.my_role()) = 'coach'
          and pl.group_id = any ((select private.my_group_ids())::uuid[])
      )
    )
  );
create policy guardian_players_write on public.guardian_players for all to authenticated
  using (private.guardian_club(guardian_id) = (select private.my_club()) and (select private.is_office()))
  with check (private.guardian_club(guardian_id) = (select private.my_club()) and (select private.is_office()));

-- events, event_teams, event_series
create policy events_select on public.events for select to authenticated
  using (private.can_see_event(id));
create policy events_write on public.events for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_office()))
  with check (club_id = (select private.my_club()) and (select private.is_office()));

create policy event_teams_select on public.event_teams for select to authenticated
  using (private.can_see_event(event_id));
create policy event_teams_write on public.event_teams for all to authenticated
  using (private.event_club(event_id) = (select private.my_club()) and (select private.is_office()))
  with check (private.event_club(event_id) = (select private.my_club()) and (select private.is_office()));

create policy event_series_select on public.event_series for select to authenticated
  using (club_id = (select private.my_club()) and (select private.is_club_staff()));
create policy event_series_write on public.event_series for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_office()))
  with check (club_id = (select private.my_club()) and (select private.is_office()));

-- attendance: cine conduce evenimentul o vede pe toată; jucătorul și părintele, rândurile lor.
-- Scrierea se face prin RPC save_attendance.
create policy attendance_select on public.attendance for select to authenticated
  using (
    private.event_club(event_id) = (select private.my_club())
    and (
      (select private.my_role()) in ('admin', 'secretary', 'sporting_director', 'physio', 'owner')
      or private.can_run_event(event_id)
      or player_id = any ((select private.my_player_ids())::uuid[])
    )
  );
create policy attendance_write on public.attendance for all to authenticated
  using (private.event_club(event_id) = (select private.my_club()) and (select private.is_office()))
  with check (private.event_club(event_id) = (select private.my_club()) and (select private.is_office()));

-- competitions, standings
create policy competitions_select on public.competitions for select to authenticated
  using (club_id = (select private.my_club()));
create policy competitions_write on public.competitions for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_office()))
  with check (club_id = (select private.my_club()) and (select private.is_office()));

create policy standings_select on public.competition_standings for select to authenticated
  using (private.competition_club(competition_id) = (select private.my_club()));
create policy standings_write on public.competition_standings for all to authenticated
  using (private.competition_club(competition_id) = (select private.my_club()) and (select private.is_office()))
  with check (private.competition_club(competition_id) = (select private.my_club()) and (select private.is_office()));

-- matches și detaliile lor: citire ca evenimentul; scriere prin RPC (antrenor) sau direct (birou).
create policy matches_select on public.matches for select to authenticated
  using (private.can_see_event(event_id));
create policy matches_write on public.matches for all to authenticated
  using (private.event_club(event_id) = (select private.my_club()) and (select private.is_office()))
  with check (private.event_club(event_id) = (select private.my_club()) and (select private.is_office()));

create policy match_squad_select on public.match_squad for select to authenticated
  using (private.can_see_event(event_id));
create policy match_squad_write on public.match_squad for all to authenticated
  using (private.event_club(event_id) = (select private.my_club()) and (select private.is_office()))
  with check (private.event_club(event_id) = (select private.my_club()) and (select private.is_office()));

create policy match_events_select on public.match_events for select to authenticated
  using (private.can_see_event(event_id));
create policy match_events_write on public.match_events for all to authenticated
  using (private.event_club(event_id) = (select private.my_club()) and (select private.is_office()))
  with check (private.event_club(event_id) = (select private.my_club()) and (select private.is_office()));

create policy suspensions_select on public.suspensions for select to authenticated
  using (club_id = (select private.my_club())
     and ((select private.is_club_staff()) or player_id = any ((select private.my_player_ids())::uuid[])));
create policy suspensions_write on public.suspensions for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_office()))
  with check (club_id = (select private.my_club()) and (select private.is_office()));

-- Politici suplimentare pe tabele existente, pentru rolurile noi -----------------
create policy players_select_office on public.players for select to authenticated
  using (club_id = (select private.my_club())
     and ((select private.my_role()) in ('admin', 'secretary', 'accountant')
          or id = any ((select private.my_player_ids())::uuid[])));
create policy players_write_office on public.players for all to authenticated
  using (club_id = (select private.my_club()) and (select private.my_role()) in ('admin', 'secretary'))
  with check (club_id = (select private.my_club()) and (select private.my_role()) in ('admin', 'secretary'));

create policy player_contacts_office on public.player_contacts for all to authenticated
  using (exists (select 1 from public.players pl where pl.id = player_contacts.player_id
                 and pl.club_id = (select private.my_club()) and (select private.my_role()) in ('admin', 'secretary')))
  with check (exists (select 1 from public.players pl where pl.id = player_contacts.player_id
                 and pl.club_id = (select private.my_club()) and (select private.my_role()) in ('admin', 'secretary')));

create policy groups_write_office on public.groups for all to authenticated
  using (club_id = (select private.my_club()) and (select private.my_role()) in ('admin', 'secretary', 'sporting_director'))
  with check (club_id = (select private.my_club()) and (select private.my_role()) in ('admin', 'secretary', 'sporting_director'));

create policy clubs_update_admin on public.clubs for update to authenticated
  using (id = (select private.my_club()) and (select private.my_role()) = 'admin')
  with check (id = (select private.my_club()) and (select private.my_role()) = 'admin');

create policy profiles_admin on public.profiles for all to authenticated
  using (club_id = (select private.my_club()) and (select private.my_role()) = 'admin')
  with check (club_id = (select private.my_club()) and (select private.my_role()) = 'admin');

create policy staff_groups_admin on public.staff_groups for all to authenticated
  using (private.group_club(group_id) = (select private.my_club()) and (select private.my_role()) = 'admin')
  with check (private.group_club(group_id) = (select private.my_club()) and (select private.my_role()) = 'admin');

create policy club_statuses_admin on public.club_statuses for all to authenticated
  using (club_id = (select private.my_club()) and (select private.my_role()) = 'admin')
  with check (club_id = (select private.my_club()) and (select private.my_role()) = 'admin');

-- Biroul și antrenorul văd profilurile de staff ale clubului (nume pentru calendar, antrenori pe echipe).
create policy profiles_staff_directory on public.profiles for select to authenticated
  using (club_id = (select private.my_club())
     and (select private.my_role()) in ('admin', 'secretary', 'sporting_director', 'physio', 'coach', 'accountant')
     and role in ('admin', 'secretary', 'sporting_director', 'physio', 'coach', 'accountant', 'owner'));
create policy staff_groups_directory on public.staff_groups for select to authenticated
  using (private.group_club(group_id) = (select private.my_club()) and (select private.is_club_staff()));
