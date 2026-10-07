-- =============================================================================
-- 0001 · Schema de bază
-- Platformă medicală și de pregătire fizică — multi-club.
-- Toate tabelele au RLS activat în migrarea 0002. Nimic nu este expus rolului anon.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum (
  'owner',             -- Patron
  'sporting_director', -- Director sportiv
  'physio',            -- Preparator fizic („god view")
  'coach',             -- Antrenor
  'player',            -- Jucător
  'medical_partner'    -- Partener medical extern
);

-- ---------------------------------------------------------------------------
-- Club și configurare
-- ---------------------------------------------------------------------------
create table public.clubs (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  short_name      text,
  logo_path       text,
  primary_color   text not null default '#0B3D2E',
  accent_color    text not null default '#F2B705',
  -- Setări: fus orar, început de sezon, oră memento, valabilitate viză,
  -- retenție, praguri de alertă. Vezi packages/shared/src/settings.ts.
  settings        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create table public.club_statuses (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  code          text not null,
  label         text not null,
  short_label   text not null,
  tone          text not null default 'gray' check (tone in ('green','yellow','orange','red','gray','blue')),
  icon          text not null default 'circle',
  -- disponibil pentru antrenament complet / parțial / indisponibil
  availability  text not null default 'full' check (availability in ('full','limited','out')),
  sort          int  not null default 0,
  is_active     boolean not null default true,
  unique (club_id, code)
);

create table public.groups (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references public.clubs(id) on delete cascade,
  name             text not null,
  sort             int  not null default 0,
  is_active        boolean not null default true,
  -- Întrebări suplimentare la chestionar, oprite implicit:
  -- {"sleep": false, "stress": false, "mood": false}
  wellness_config  jsonb not null default '{}'::jsonb,
  reminder_hour    smallint check (reminder_hour between 0 and 23),
  created_at       timestamptz not null default now(),
  unique (club_id, name)
);

-- ---------------------------------------------------------------------------
-- Utilizatori
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  club_id               uuid not null references public.clubs(id) on delete cascade,
  role                  public.app_role not null,
  full_name             text not null,
  email                 text,
  phone                 text,
  is_active             boolean not null default true,
  email_notifications   boolean not null default true,
  must_change_password  boolean not null default false,
  created_at            timestamptz not null default now()
);
create index profiles_club_role_idx on public.profiles (club_id, role);

-- Grupele unui membru de staff (antrenorul poate avea mai multe).
create table public.staff_groups (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  group_id  uuid not null references public.groups(id) on delete cascade,
  primary key (user_id, group_id)
);

-- ---------------------------------------------------------------------------
-- Jucători
-- ---------------------------------------------------------------------------
create table public.players (
  id                      uuid primary key default gen_random_uuid(),
  club_id                 uuid not null references public.clubs(id) on delete cascade,
  user_id                 uuid unique references public.profiles(id) on delete set null,
  group_id                uuid references public.groups(id) on delete set null,
  full_name               text not null,          -- nume complet (evidența oficială)
  display_name            text not null,          -- nume scurt, folosit de staff
  birth_date              date,
  position                text,                   -- cod: GK, DEF, MID, FWD (+ detaliu liber)
  position_detail         text,
  dominant_foot           text check (dominant_foot in ('left','right','both')),
  shirt_number            smallint,
  photo_path              text,
  medical_visa_expires_on date,
  -- Stare curentă (istoricul este în status_history)
  status_id               uuid references public.club_statuses(id) on delete set null,
  status_note             text,                   -- observații, text liber
  status_zone             text,                   -- cod zonă corp (packages/shared/src/body.ts)
  status_side             text check (status_side in ('left','right','both')),
  status_zone_detail      text,                   -- ex. „ligament", „metatarsiene"
  status_zone_uncertain   boolean not null default false,
  status_return_on        date,                   -- dată estimată de revenire
  training_restrictions   text,
  status_updated_at       timestamptz,
  -- Import
  needs_review            boolean not null default false,
  review_note             text,
  is_active               boolean not null default true,
  anonymized_at           timestamptz,
  created_at              timestamptz not null default now()
);
create index players_club_group_idx on public.players (club_id, group_id);

-- Date de contact, separate de fișa de bază ca să poată avea reguli de acces mai stricte.
create table public.player_contacts (
  player_id       uuid primary key references public.players(id) on delete cascade,
  phone           text,
  email           text,
  guardian_name   text,
  guardian_phone  text,
  guardian_email  text,
  updated_at      timestamptz not null default now()
);

create table public.player_group_history (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  group_id   uuid references public.groups(id) on delete set null,
  from_date  date not null default current_date,
  to_date    date
);
create index player_group_history_player_idx on public.player_group_history (player_id);

create table public.status_history (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references public.players(id) on delete cascade,
  status_id      uuid references public.club_statuses(id) on delete set null,
  note           text,
  zone           text,
  side           text,
  zone_detail    text,
  zone_uncertain boolean not null default false,
  return_on      date,
  changed_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index status_history_player_idx on public.status_history (player_id, created_at desc);

create table public.anthropometrics (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.players(id) on delete cascade,
  measured_on   date not null default current_date,
  height_cm     numeric(5,1) check (height_cm between 80 and 250),
  weight_kg     numeric(5,1) check (weight_kg between 20 and 200),
  body_fat_pct  numeric(4,1) check (body_fat_pct between 2 and 60),
  muscle_mass_kg numeric(5,1),
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index anthropometrics_player_idx on public.anthropometrics (player_id, measured_on desc);

-- ---------------------------------------------------------------------------
-- Medical
-- ---------------------------------------------------------------------------
create table public.injuries (
  id                  uuid primary key default gen_random_uuid(),
  player_id           uuid not null references public.players(id) on delete cascade,
  zone                text,                -- cod zonă corp
  side                text check (side in ('left','right','both')),
  zone_detail         text,
  zone_uncertain      boolean not null default false,
  injury_type         text,                -- muscular, ligamentar, osos, tendinos, articular, contuzie, altul
  contact             text check (contact in ('contact','non_contact','unknown')),
  context             text check (context in ('training','match','other','unknown')),
  occurred_on         date not null default current_date,
  diagnosis           text,
  severity            text check (severity in ('minor','moderate','severe','unknown')),
  expected_return_on  date,
  actual_return_on    date,
  rtp_stage           smallint not null default 0 check (rtp_stage between 0 and 5),
  notes               text,
  recurrence_of       uuid references public.injuries(id) on delete set null,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (actual_return_on is null or actual_return_on >= occurred_on)
);
create index injuries_player_idx on public.injuries (player_id, occurred_on desc);
create index injuries_open_idx on public.injuries (player_id) where actual_return_on is null;

create table public.injury_treatments (
  id           uuid primary key default gen_random_uuid(),
  injury_id    uuid not null references public.injuries(id) on delete cascade,
  treated_on   date not null default current_date,
  description  text not null,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index injury_treatments_injury_idx on public.injury_treatments (injury_id, treated_on desc);

create table public.medical_documents (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.players(id) on delete cascade,
  injury_id     uuid references public.injuries(id) on delete set null,
  title         text not null,
  kind          text not null default 'other' check (kind in ('mri','ultrasound','xray','letter','lab','consent','other')),
  storage_path  text not null unique,     -- în bucketul privat „medical"
  mime_type     text,
  size_bytes    bigint,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index medical_documents_player_idx on public.medical_documents (player_id, created_at desc);

-- Trimiteri către partenerul medical extern
create table public.referrals (
  id               uuid primary key default gen_random_uuid(),
  player_id        uuid not null references public.players(id) on delete cascade,
  partner_user_id  uuid not null references public.profiles(id) on delete cascade,
  injury_id        uuid references public.injuries(id) on delete set null,  -- null = întreaga fișă de accidentări
  reason           text,
  is_active        boolean not null default true,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  closed_at        timestamptz
);
create index referrals_partner_idx on public.referrals (partner_user_id) where is_active;
create index referrals_player_idx on public.referrals (player_id);

create table public.partner_notes (
  id           uuid primary key default gen_random_uuid(),
  referral_id  uuid not null references public.referrals(id) on delete cascade,
  author_id    uuid references public.profiles(id) on delete set null,
  note         text not null,
  created_at   timestamptz not null default now()
);
create index partner_notes_referral_idx on public.partner_notes (referral_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Exerciții, programe, planuri
-- ---------------------------------------------------------------------------
create table public.exercises (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references public.clubs(id) on delete cascade,
  slug               text,
  name               text not null,
  description        text,
  steps              text[] not null default '{}',
  category           text not null default 'prevention'
                     check (category in ('prevention','recovery','kinetotherapy','mobility','strength','activation')),
  zones              text[] not null default '{}',     -- coduri zone corp
  equipment          text[] not null default '{}',
  level              text not null default 'beginner' check (level in ('beginner','intermediate','advanced')),
  contraindications  text,
  video_url          text,          -- link extern (YouTube/Vimeo/fișier)
  video_path         text,          -- clip încărcat în bucketul „exercise-media"
  image_url          text,
  source             text,          -- de unde provine materialul
  license            text,          -- ex. „CC BY-SA 4.0", „Domeniu public", „Clip propriu"
  attribution        text,
  is_active          boolean not null default true,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  unique (club_id, slug)
);
create index exercises_club_idx on public.exercises (club_id, is_active);

create table public.programs (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  slug         text,
  name         text not null,
  description  text,
  kind         text not null default 'prevention' check (kind in ('prevention','recovery','warmup','other')),
  is_template  boolean not null default false,
  is_active    boolean not null default true,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (club_id, slug)
);

create table public.program_exercises (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid not null references public.programs(id) on delete cascade,
  exercise_id   uuid not null references public.exercises(id) on delete cascade,
  sort          int not null default 0,
  sets          smallint,
  reps          text,              -- „10", „8–12", „câte 6 pe fiecare parte"
  duration_sec  int,
  rest_sec      int,
  tempo         text,
  notes         text
);
create index program_exercises_program_idx on public.program_exercises (program_id, sort);

create table public.program_assignments (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  program_id   uuid not null references public.programs(id) on delete cascade,
  target_type  text not null check (target_type in ('player','group','position','manual')),
  group_id     uuid references public.groups(id) on delete set null,
  position     text,
  start_date   date not null default current_date,
  end_date     date,
  weekdays     smallint[] not null default '{1,3,5}',   -- 1 = luni … 7 = duminică
  notes        text,
  is_active    boolean not null default true,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

-- Lista efectivă de jucători a unei alocări (materializată la alocare).
create table public.program_assignment_players (
  assignment_id  uuid not null references public.program_assignments(id) on delete cascade,
  player_id      uuid not null references public.players(id) on delete cascade,
  primary key (assignment_id, player_id)
);
create index pap_player_idx on public.program_assignment_players (player_id);

create table public.daily_plans (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players(id) on delete cascade,
  plan_date   date not null,
  title       text,
  notes       text,
  injury_id   uuid references public.injuries(id) on delete set null,
  rtp_stage   smallint check (rtp_stage between 0 and 5),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (player_id, plan_date)
);

create table public.daily_plan_items (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references public.daily_plans(id) on delete cascade,
  exercise_id   uuid not null references public.exercises(id) on delete cascade,
  sort          int not null default 0,
  sets          smallint,
  reps          text,
  duration_sec  int,
  rest_sec      int,
  tempo         text,
  notes         text
);
create index daily_plan_items_plan_idx on public.daily_plan_items (plan_id, sort);

-- Bifele jucătorului: fie pe un exercițiu de program (într-o zi), fie pe un item din planul zilei.
create table public.exercise_completions (
  id                   uuid primary key default gen_random_uuid(),
  player_id            uuid not null references public.players(id) on delete cascade,
  done_on              date not null,
  assignment_id        uuid references public.program_assignments(id) on delete cascade,
  program_exercise_id  uuid references public.program_exercises(id) on delete cascade,
  plan_item_id         uuid references public.daily_plan_items(id) on delete cascade,
  done                 boolean not null default true,
  comment              text,
  pain                 boolean not null default false,
  pain_intensity       smallint check (pain_intensity between 1 and 10),
  created_at           timestamptz not null default now(),
  check (
    (plan_item_id is not null and assignment_id is null and program_exercise_id is null)
    or (plan_item_id is null and assignment_id is not null and program_exercise_id is not null)
  )
);
create unique index exercise_completions_program_uq
  on public.exercise_completions (player_id, done_on, assignment_id, program_exercise_id)
  where plan_item_id is null;
create unique index exercise_completions_plan_uq
  on public.exercise_completions (player_id, plan_item_id)
  where plan_item_id is not null;

-- ---------------------------------------------------------------------------
-- Chestionar zilnic și încărcare
-- ---------------------------------------------------------------------------
create table public.wellness_entries (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references public.players(id) on delete cascade,
  entry_date      date not null,
  fatigue         smallint check (fatigue between 1 and 10),       -- 1 = deloc, 10 = maxim
  muscle_load     smallint check (muscle_load between 1 and 10),   -- 1 = deloc, 10 = maxim
  pain_zone       text,
  pain_side       text check (pain_side in ('left','right','both')),
  pain_intensity  smallint check (pain_intensity between 1 and 10),
  pain_note       text,
  -- întrebări opționale
  sleep_quality   smallint check (sleep_quality between 1 and 10),
  sleep_hours     numeric(3,1) check (sleep_hours between 0 and 16),
  stress          smallint check (stress between 1 and 10),
  mood            smallint check (mood between 1 and 10),
  source          text not null default 'app' check (source in ('app','import','staff')),
  needs_review    boolean not null default false,
  review_note     text,
  raw             jsonb,            -- valorile originale din import, dacă au fost neregulate
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (player_id, entry_date)
);
create index wellness_entries_date_idx on public.wellness_entries (entry_date);

create table public.physical_sessions (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  group_id      uuid references public.groups(id) on delete set null,
  session_date  date not null,
  session_type  text not null default 'training' check (session_type in ('training','match','test','other')),
  name          text not null default '',
  duration_min  int,
  source        text not null default 'manual' check (source in ('manual','ksport','import')),
  import_id     uuid,
  created_at    timestamptz not null default now(),
  unique (club_id, session_date, name, source)
);

create table public.physical_metrics (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references public.physical_sessions(id) on delete cascade,
  player_id          uuid not null references public.players(id) on delete cascade,
  duration_min       numeric(6,1),
  total_distance_m   numeric(8,1),
  hsr_distance_m     numeric(8,1),   -- distanță la viteză mare
  sprint_distance_m  numeric(8,1),
  sprint_count       int,
  max_speed_kmh      numeric(4,1),
  accelerations      int,
  decelerations      int,
  player_load        numeric(8,1),
  hr_avg             int,
  hr_max             int,
  extra              jsonb not null default '{}'::jsonb,   -- orice altă coloană mapată
  unique (session_id, player_id)
);
create index physical_metrics_player_idx on public.physical_metrics (player_id);

-- RPE × durată = încărcare internă (sRPE)
create table public.rpe_entries (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.players(id) on delete cascade,
  entry_date    date not null,
  session_type  text not null default 'training' check (session_type in ('training','match','other')),
  rpe           smallint not null check (rpe between 1 and 10),
  duration_min  int not null check (duration_min between 1 and 300),
  load          int generated always as (rpe * duration_min) stored,
  created_at    timestamptz not null default now(),
  unique (player_id, entry_date, session_type)
);

create table public.fitness_tests (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references public.clubs(id) on delete cascade,
  code             text not null,
  name             text not null,
  unit             text not null,
  lower_is_better  boolean not null default false,
  sort             int not null default 0,
  is_active        boolean not null default true,
  unique (club_id, code)
);

create table public.fitness_test_results (
  id          uuid primary key default gen_random_uuid(),
  test_id     uuid not null references public.fitness_tests(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  tested_on   date not null default current_date,
  value       numeric(8,2) not null,
  notes       text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (test_id, player_id, tested_on)
);
create index fitness_test_results_player_idx on public.fitness_test_results (player_id, tested_on desc);

-- ---------------------------------------------------------------------------
-- Alerte, notificări
-- ---------------------------------------------------------------------------
create table public.alerts (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  player_id    uuid not null references public.players(id) on delete cascade,
  kind         text not null check (kind in (
                 'fatigue_high','muscle_load_high','fatigue_spike','pain_reported',
                 'exercise_pain','missing_wellness','visa_expiring')),
  severity     text not null default 'warning' check (severity in ('info','warning','critical')),
  alert_date   date not null,
  message      text not null,
  data         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references public.profiles(id) on delete set null,
  unique (player_id, kind, alert_date)
);
create index alerts_open_idx on public.alerts (club_id, alert_date desc) where resolved_at is null;

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text,
  link        text,
  dedupe_key  text,
  read_at     timestamptz,
  emailed_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create unique index notifications_dedupe_uq on public.notifications (user_id, dedupe_key) where dedupe_key is not null;

-- Tokenuri push pentru aplicația nativă (Expo) — folosite din versiunea nativă.
create table public.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  token       text not null,
  platform    text check (platform in ('ios','android','web')),
  created_at  timestamptz not null default now(),
  unique (user_id, token)
);

-- ---------------------------------------------------------------------------
-- Importuri
-- ---------------------------------------------------------------------------
create table public.imports (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  kind        text not null check (kind in ('health_status','fatigue_grid','roster','physical','tests')),
  filename    text,
  file_hash   text,
  mapping     jsonb,
  report      jsonb,
  rows_imported int not null default 0,
  rows_skipped  int not null default 0,
  rows_flagged  int not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index imports_club_idx on public.imports (club_id, created_at desc);

create table public.import_templates (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  kind        text not null,
  name        text not null,
  mapping     jsonb not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (club_id, kind, name)
);

-- Potriviri de nume confirmate de preparator; se țin minte între importuri.
create table public.name_matches (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  source_name  text not null,           -- normalizat (majuscule, fără diacritice)
  group_id     uuid references public.groups(id) on delete cascade,
  player_id    uuid not null references public.players(id) on delete cascade,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create unique index name_matches_uq on public.name_matches
  (club_id, source_name, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ---------------------------------------------------------------------------
-- GDPR: consimțământ, cereri, audit
-- ---------------------------------------------------------------------------
create table public.consents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.profiles(id) on delete cascade,
  player_id       uuid references public.players(id) on delete cascade,
  kind            text not null check (kind in ('self','guardian_digital','guardian_paper','staff_confidentiality')),
  text_version    text not null,
  guardian_name   text,
  guardian_relation text,
  document_id     uuid references public.medical_documents(id) on delete set null,
  accepted_at     timestamptz not null default now(),
  recorded_by     uuid references public.profiles(id) on delete set null,
  withdrawn_at    timestamptz,
  check (user_id is not null or player_id is not null)
);
create index consents_user_idx on public.consents (user_id);
create index consents_player_idx on public.consents (player_id);

create table public.data_requests (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  player_id   uuid references public.players(id) on delete set null,
  kind        text not null check (kind in ('export','delete','rectify','withdraw_consent')),
  message     text,
  status      text not null default 'open' check (status in ('open','done','rejected')),
  handled_by  uuid references public.profiles(id) on delete set null,
  handled_at  timestamptz,
  response    text,
  created_at  timestamptz not null default now()
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  club_id     uuid references public.clubs(id) on delete cascade,
  actor_id    uuid,                 -- fără FK: jurnalul supraviețuiește ștergerii contului
  actor_role  text,
  action      text not null,        -- INSERT / UPDATE / DELETE / READ / EXPORT / LOGIN …
  entity      text not null,
  entity_id   text,
  player_id   uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_club_idx on public.audit_log (club_id, created_at desc);
create index audit_log_player_idx on public.audit_log (player_id, created_at desc);
