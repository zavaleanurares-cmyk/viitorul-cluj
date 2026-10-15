-- Locker Room · faza 3 · Bani: schema.
--
-- Un singur registru: fiecare sumă datorată este o taxă (charges), fiecare ban primit este o plată (payments),
-- iar legătura dintre ele este o alocare (allocations). Taxele lunare, cererile de plată, raportul,
-- bugetul și Azi citesc toate din aceleași trei tabele, deci nu se pot contrazice.
--
-- Sume: întregi, în bani (1 leu = 100 de bani). Nicio coloană de bani nu este numeric/float.
-- Operatorul de plăți online nu apare aici decât ca text (provider); totul despre el stă în adaptoare.
set local check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Ajutoare de acces
-- ---------------------------------------------------------------------------
-- Biroul financiar: emite taxe, înregistrează plăți, vede tot registrul.
create or replace function private.is_finance() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.my_role()) in ('admin', 'secretary', 'accountant'), false)
$$;

-- Cine vede cifrele agregate (fără rânduri pe familii): biroul financiar, directorul, patronul.
create or replace function private.can_see_money_summary() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.my_role()) in ('admin', 'secretary', 'accountant', 'sporting_director', 'owner'), false)
$$;

-- Părinții (rânduri din guardians) legați de contul meu, în clubul curent.
create or replace function private.my_guardian_ids() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(g.id), '{}'::uuid[]) from public.guardians g
  where g.user_id = (select app_auth.uid()) and g.club_id = (select private.my_club()) and g.deleted_at is null
$$;

-- Contoare pe club (numere de chitanță pe an, numere de referat, coduri de plată). Blochează rândul.
create table public.club_counters (
  club_id  uuid not null references public.clubs(id) on delete cascade deferrable initially deferred,
  name     text not null,
  value    bigint not null default 0,
  primary key (club_id, name)
);
alter table public.club_counters enable row level security;
grant all on public.club_counters to service_role;

create or replace function private.next_counter(p_club uuid, p_name text, p_start bigint default 1) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v bigint;
begin
  insert into public.club_counters as c (club_id, name, value) values (p_club, p_name, p_start)
  on conflict (club_id, name) do update set value = c.value + 1
  returning value into v;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Setări financiare ale clubului
-- ---------------------------------------------------------------------------
create table public.finance_settings (
  club_id               uuid primary key references public.clubs(id) on delete cascade deferrable initially deferred,
  currency              text not null default 'RON' check (currency ~ '^[A-Z]{3}$'),
  issue_day             smallint not null default 1 check (issue_day between 1 and 28),
  due_day               smallint not null default 10 check (due_day between 1 and 28),
  reminder_days         smallint[] not null default '{5,15,25}',
  fee_months            smallint[] not null default '{1,2,3,4,5,6,7,8,9,10,11,12}',
  sibling_discount_pct  smallint not null default 0 check (sibling_discount_pct between 0 and 100),
  auto_issue            boolean not null default true,
  -- date pentru chitanțe și transfer bancar
  beneficiary           text,
  fiscal_code           text,
  address               text,
  iban                  text check (iban is null or iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{8,30}$'),
  bank_name             text,
  receipt_prefix        text not null default 'CH' check (receipt_prefix ~ '^[A-Z0-9]{1,6}$'),
  ref_prefix            text not null default 'LR' check (ref_prefix ~ '^[A-Z0-9]{2,6}$'),
  -- operatorul de plăți online (adaptorul activ); „test" nu mișcă bani
  provider              text not null default 'test',
  online_enabled        boolean not null default true,
  vat_rates             smallint[] not null default '{21,11,0}',
  approver_roles        public.app_role[] not null default '{admin,owner}',
  updated_at            timestamptz not null default now()
);
insert into public.finance_settings (club_id) select id from public.clubs on conflict do nothing;

create or replace function private.clubs_finance_settings() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.finance_settings (club_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger clubs_finance_settings after insert on public.clubs
  for each row execute function private.clubs_finance_settings();

-- Codul de plată al familiei („LR-1042"): îl scrie la mențiuni la transferul bancar și plata se asociază singură.
alter table public.guardians add column payment_ref text;
create unique index guardians_payment_ref_uq on public.guardians (club_id, payment_ref) where payment_ref is not null;

create or replace function private.guardians_payment_ref() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_prefix text;
begin
  if new.payment_ref is null then
    select coalesce(fs.ref_prefix, 'LR') into v_prefix from public.finance_settings fs where fs.club_id = new.club_id;
    new.payment_ref := coalesce(v_prefix, 'LR') || '-' || private.next_counter(new.club_id, 'payment_ref', 1001)::text;
  end if;
  return new;
end $$;
create trigger guardians_payment_ref before insert on public.guardians
  for each row execute function private.guardians_payment_ref();

do $$
declare r record;
begin
  for r in select g.id, g.club_id from public.guardians g where g.payment_ref is null order by g.created_at loop
    update public.guardians set payment_ref =
      coalesce((select fs.ref_prefix from public.finance_settings fs where fs.club_id = r.club_id), 'LR')
      || '-' || private.next_counter(r.club_id, 'payment_ref', 1001)::text
    where id = r.id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Taxe: planuri, reduceri, cereri de plată, taxe emise
-- ---------------------------------------------------------------------------
-- Taxa lunară: pe echipă (implicit) sau pe jucător (are prioritate). Valabilă din luna X (până la luna Y).
create table public.fee_plans (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade deferrable initially deferred,
  group_id    uuid references public.groups(id) on delete cascade deferrable initially deferred,
  player_id   uuid references public.players(id) on delete cascade deferrable initially deferred,
  amount      bigint not null check (amount >= 0 and amount <= 100000000),
  valid_from  date not null check (extract(day from valid_from) = 1),
  valid_to    date check (valid_to is null or (extract(day from valid_to) = 1 and valid_to >= valid_from)),
  reason      text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  check ((group_id is null) <> (player_id is null))
);
create index fee_plans_club_idx on public.fee_plans (club_id) where deleted_at is null;
create index fee_plans_player_idx on public.fee_plans (player_id) where deleted_at is null;
create index fee_plans_group_idx on public.fee_plans (group_id) where deleted_at is null;

-- Reduceri și scutiri: procent, sumă fixă sau scutire totală, pe un interval de luni.
create table public.fee_adjustments (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade deferrable initially deferred,
  player_id   uuid not null references public.players(id) on delete cascade deferrable initially deferred,
  kind        text not null check (kind in ('percent', 'amount', 'waiver')),
  value       bigint not null default 0 check (value >= 0),
  reason      text not null check (reason in ('sibling', 'scholarship', 'injury', 'pause', 'staff_child', 'other')),
  note        text,
  from_month  date not null check (extract(day from from_month) = 1),
  to_month    date check (to_month is null or (extract(day from to_month) = 1 and to_month >= from_month)),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  check (kind <> 'percent' or value <= 100)
);
create index fee_adjustments_player_idx on public.fee_adjustments (player_id) where deleted_at is null;

-- Cereri de plată în afara taxei lunare (individualizare, cantonament, echipament, asigurare).
create table public.charge_requests (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade deferrable initially deferred,
  title       text not null check (length(title) between 1 and 120),
  description text,
  kind        text not null default 'one_off' check (kind in ('one_off', 'camp', 'equipment', 'insurance', 'other')),
  amount      bigint not null check (amount > 0 and amount <= 100000000),
  due_on      date not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index charge_requests_club_idx on public.charge_requests (club_id) where deleted_at is null;

-- O sumă datorată. Suma netă = amount − discount. Plătit = suma alocărilor (vezi charge_balances).
create table public.charges (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade deferrable initially deferred,
  player_id    uuid not null references public.players(id) on delete cascade deferrable initially deferred,
  guardian_id  uuid references public.guardians(id) on delete set null,
  kind         text not null check (kind in ('monthly', 'one_off', 'camp', 'equipment', 'insurance', 'other')),
  request_id   uuid references public.charge_requests(id) on delete cascade deferrable initially deferred,
  period       date check (period is null or extract(day from period) = 1),
  title        text not null,
  amount       bigint not null check (amount >= 0 and amount <= 100000000),
  discount     bigint not null default 0 check (discount >= 0),
  discount_note text,
  due_on       date not null,
  status       text not null default 'open' check (status in ('open', 'cancelled')),
  cancel_reason text,
  issued_at    timestamptz not null default now(),
  created_by   uuid references public.profiles(id) on delete set null,
  check (discount <= amount),
  check (kind <> 'monthly' or period is not null)
);
create unique index charges_monthly_uq on public.charges (player_id, period) where kind = 'monthly' and status <> 'cancelled';
create index charges_club_idx on public.charges (club_id, due_on);
create index charges_player_idx on public.charges (player_id);
create index charges_guardian_idx on public.charges (guardian_id);
create index charges_request_idx on public.charges (request_id);

-- ---------------------------------------------------------------------------
-- Plăți și alocări
-- ---------------------------------------------------------------------------
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references public.clubs(id) on delete cascade deferrable initially deferred,
  guardian_id     uuid references public.guardians(id) on delete set null,
  player_id       uuid references public.players(id) on delete set null,
  amount          bigint not null check (amount > 0 and amount <= 1000000000),
  method          text not null check (method in ('cash', 'bank', 'online', 'card')),
  provider        text,
  provider_ref    text,
  received_on     date not null,
  payer_name      text,
  reference       text,
  note            text,
  status          text not null default 'completed' check (status in ('completed', 'void')),
  refunded_amount bigint not null default 0 check (refunded_amount >= 0),
  void_reason     text,
  recorded_by     uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  check (refunded_amount <= amount),
  check ((method = 'online') = (provider is not null))
);
create unique index payments_provider_uq on public.payments (provider, provider_ref) where provider_ref is not null;
create index payments_club_idx on public.payments (club_id, received_on desc);
create index payments_guardian_idx on public.payments (guardian_id);
create index payments_player_idx on public.payments (player_id);

create table public.allocations (
  id          uuid primary key default gen_random_uuid(),
  payment_id  uuid not null references public.payments(id) on delete cascade deferrable initially deferred,
  charge_id   uuid not null references public.charges(id) on delete cascade deferrable initially deferred,
  amount      bigint not null check (amount > 0),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (payment_id, charge_id)
);
create index allocations_charge_idx on public.allocations (charge_id);

-- Nicio plată nu se împarte peste suma ei (minus ce s-a returnat) și nicio taxă nu primește peste suma netă.
-- Constrângere amânată: o realocare (șterge + inserează) se verifică la sfârșitul tranzacției.
create or replace function private.allocations_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_pay record; v_charge record; v_sum bigint;
begin
  if tg_op = 'DELETE' then return null; end if;
  select p.amount - p.refunded_amount as avail, p.status, p.club_id into v_pay from public.payments p where p.id = new.payment_id;
  if v_pay is null then return null; end if;  -- plata a fost ștearsă în aceeași tranzacție
  select c.amount - c.discount as net, c.status, c.club_id into v_charge from public.charges c where c.id = new.charge_id;
  if v_charge is null then return null; end if;
  if v_pay.club_id <> v_charge.club_id then raise exception 'Plata și taxa sunt din cluburi diferite.'; end if;
  if v_pay.status = 'void' then raise exception 'Plata este anulată.'; end if;
  if v_charge.status = 'cancelled' then raise exception 'Taxa este anulată.'; end if;
  select coalesce(sum(a.amount), 0) into v_sum from public.allocations a where a.payment_id = new.payment_id;
  if v_sum > v_pay.avail then raise exception 'Suma împărțită depășește plata.' using errcode = '23514'; end if;
  select coalesce(sum(a.amount), 0) into v_sum from public.allocations a where a.charge_id = new.charge_id;
  if v_sum > v_charge.net then raise exception 'Taxa ar fi plătită peste sumă.' using errcode = '23514'; end if;
  return null;
end $$;
create constraint trigger allocations_check after insert or update on public.allocations
  deferrable initially deferred for each row execute function private.allocations_check();

-- ---------------------------------------------------------------------------
-- Plăți online: intenții, metode salvate, evenimentele brute ale operatorului
-- ---------------------------------------------------------------------------
create table public.payment_intents (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade deferrable initially deferred,
  guardian_id   uuid references public.guardians(id) on delete set null,
  player_id     uuid references public.players(id) on delete set null,
  provider      text not null,
  provider_ref  text,
  amount        bigint not null check (amount > 0),
  charge_ids    uuid[] not null default '{}',
  status        text not null default 'created' check (status in ('created', 'pending', 'succeeded', 'failed', 'cancelled', 'expired')),
  checkout_url  text,
  save_method   boolean not null default false,
  payment_id    uuid references public.payments(id) on delete set null,
  failure       text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index payment_intents_provider_uq on public.payment_intents (provider, provider_ref) where provider_ref is not null;
create index payment_intents_guardian_idx on public.payment_intents (guardian_id, created_at desc);

create table public.payment_methods (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade deferrable initially deferred,
  guardian_id   uuid not null references public.guardians(id) on delete cascade deferrable initially deferred,
  provider      text not null,
  provider_ref  text not null,
  label         text not null,
  auto_pay      boolean not null default false,
  created_at    timestamptz not null default now(),
  revoked_at    timestamptz
);
create unique index payment_methods_provider_uq on public.payment_methods (provider, provider_ref);
create unique index payment_methods_active_uq on public.payment_methods (guardian_id) where revoked_at is null;

create table public.provider_events (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid references public.clubs(id) on delete cascade deferrable initially deferred,
  provider      text not null,
  event_id      text not null,
  type          text not null,
  payload       jsonb not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  error         text,
  unique (provider, event_id)
);

-- ---------------------------------------------------------------------------
-- Chitanțe (pentru plățile în numerar): serie și număr consecutiv pe an
-- ---------------------------------------------------------------------------
create table public.receipts (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade deferrable initially deferred,
  payment_id    uuid not null unique references public.payments(id) on delete cascade deferrable initially deferred,
  series        text not null,
  number        int not null,
  issued_on     date not null,
  payer_name    text not null,
  amount        bigint not null,
  description   text not null,
  issued_by     uuid references public.profiles(id) on delete set null,
  cancelled_at  timestamptz,
  cancel_reason text,
  unique (club_id, series, number)
);

-- ---------------------------------------------------------------------------
-- Extrase bancare
-- ---------------------------------------------------------------------------
create table public.bank_statements (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade deferrable initially deferred,
  file_name    text not null,
  bank         text,
  period_from  date,
  period_to    date,
  line_count   int not null default 0,
  imported_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table public.bank_lines (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade deferrable initially deferred,
  statement_id  uuid not null references public.bank_statements(id) on delete cascade deferrable initially deferred,
  booked_on     date not null,
  amount        bigint not null check (amount <> 0),
  description   text,
  counterparty  text,
  line_hash     text not null,
  status        text not null default 'unmatched' check (status in ('unmatched', 'matched', 'ignored')),
  payment_id    uuid references public.payments(id) on delete set null,
  expense_id    uuid,
  matched_by    uuid references public.profiles(id) on delete set null,
  matched_at    timestamptz,
  unique (club_id, line_hash)
);
create index bank_lines_statement_idx on public.bank_lines (statement_id);
create index bank_lines_status_idx on public.bank_lines (club_id, status);

-- ---------------------------------------------------------------------------
-- Cheltuieli, departamente, referate de necesitate
-- ---------------------------------------------------------------------------
create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade deferrable initially deferred,
  parent_id   uuid references public.departments(id) on delete cascade deferrable initially deferred,
  name        text not null check (length(name) between 1 and 80),
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create unique index departments_name_uq on public.departments (club_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name)) where deleted_at is null;

create table public.purchase_requests (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs(id) on delete cascade deferrable initially deferred,
  number         int not null,
  department_id  uuid references public.departments(id) on delete set null,
  group_id       uuid references public.groups(id) on delete set null,
  justification  text not null check (length(justification) between 1 and 2000),
  needed_by      date,
  status         text not null default 'submitted' check (status in ('draft', 'submitted', 'approved', 'rejected', 'completed', 'cancelled')),
  total_net      bigint not null default 0,
  total_vat      bigint not null default 0,
  total          bigint not null default 0,
  spec_path      text,
  requested_by   uuid references public.profiles(id) on delete set null,
  submitted_at   timestamptz,
  decided_by     uuid references public.profiles(id) on delete set null,
  decided_at     timestamptz,
  decision_note  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (club_id, number)
);
create index purchase_requests_club_idx on public.purchase_requests (club_id, status);

create table public.purchase_request_items (
  id                 uuid primary key default gen_random_uuid(),
  request_id         uuid not null references public.purchase_requests(id) on delete cascade deferrable initially deferred,
  position           int not null,
  name               text not null check (length(name) between 1 and 200),
  details            text,
  unit               text not null default 'buc',
  quantity           numeric(12, 3) not null check (quantity > 0),
  unit_price         bigint not null check (unit_price >= 0),
  vat_rate           smallint not null check (vat_rate between 0 and 100),
  price_includes_vat boolean not null default true,
  line_net           bigint not null,
  line_vat           bigint not null
);
create index purchase_request_items_request_idx on public.purchase_request_items (request_id, position);

create table public.expenses (
  id                   uuid primary key default gen_random_uuid(),
  club_id              uuid not null references public.clubs(id) on delete cascade deferrable initially deferred,
  department_id        uuid references public.departments(id) on delete set null,
  description          text not null check (length(description) between 1 and 300),
  supplier             text,
  invoice_no           text,
  amount               bigint not null check (amount > 0 and amount <= 1000000000),
  spent_on             date not null,
  method               text not null default 'bank' check (method in ('cash', 'bank', 'card')),
  purchase_request_id  uuid references public.purchase_requests(id) on delete set null,
  group_id             uuid references public.groups(id) on delete set null,
  player_id            uuid references public.players(id) on delete set null,
  event_id             uuid references public.events(id) on delete set null,
  document_path        text,
  bank_line_id         uuid references public.bank_lines(id) on delete set null,
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  deleted_at           timestamptz
);
create index expenses_club_idx on public.expenses (club_id, spent_on desc) where deleted_at is null;
create index expenses_department_idx on public.expenses (department_id);
alter table public.bank_lines add constraint bank_lines_expense_fk foreign key (expense_id) references public.expenses(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Buget: suma planificată pe lună, pe departament (cheltuieli) sau pe încasări
-- ---------------------------------------------------------------------------
create table public.budget_lines (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs(id) on delete cascade deferrable initially deferred,
  year           smallint not null check (year between 2000 and 2100),
  month          smallint not null check (month between 1 and 12),
  kind           text not null check (kind in ('income', 'expense')),
  department_id  uuid references public.departments(id) on delete cascade deferrable initially deferred,
  amount         bigint not null check (amount >= 0),
  check (kind = 'expense' or department_id is null)
);
create unique index budget_lines_uq on public.budget_lines
  (club_id, year, month, kind, coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ---------------------------------------------------------------------------
-- Prime legate de rezultate
-- ---------------------------------------------------------------------------
create table public.bonus_rules (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references public.clubs(id) on delete cascade deferrable initially deferred,
  name            text not null,
  target          text not null check (target in ('player', 'staff')),
  group_id        uuid references public.groups(id) on delete cascade deferrable initially deferred,
  competition_id  uuid references public.competitions(id) on delete cascade deferrable initially deferred,
  trigger         text not null check (trigger in ('win', 'draw', 'goal', 'clean_sheet', 'appearance', 'starter')),
  amount          bigint not null check (amount > 0 and amount <= 100000000),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  check (target = 'player' or trigger in ('win', 'draw', 'clean_sheet'))
);

create table public.bonus_entries (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade deferrable initially deferred,
  rule_id     uuid not null references public.bonus_rules(id) on delete cascade deferrable initially deferred,
  event_id    uuid not null references public.events(id) on delete cascade deferrable initially deferred,
  player_id   uuid references public.players(id) on delete cascade deferrable initially deferred,
  profile_id  uuid references public.profiles(id) on delete cascade deferrable initially deferred,
  quantity    int not null default 1 check (quantity > 0),
  amount      bigint not null check (amount >= 0),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'cancelled')),
  decided_by  uuid references public.profiles(id) on delete set null,
  decided_at  timestamptz,
  created_at  timestamptz not null default now(),
  check ((player_id is null) <> (profile_id is null))
);
create unique index bonus_entries_uq on public.bonus_entries (rule_id, event_id, coalesce(player_id, profile_id));

-- ---------------------------------------------------------------------------
-- Vederi: soldul fiecărei taxe și al fiecărei plăți (respectă RLS-ul tabelelor)
-- ---------------------------------------------------------------------------
create view public.charge_balances with (security_invoker = true) as
  select c.id, c.club_id, c.player_id, c.guardian_id, c.kind, c.request_id, c.period, c.title,
         c.amount, c.discount, c.discount_note, c.amount - c.discount as net, c.due_on, c.status, c.issued_at,
         coalesce(a.paid, 0) as paid,
         case when c.status = 'cancelled' then 0 else c.amount - c.discount - coalesce(a.paid, 0) end as balance,
         case
           when c.status = 'cancelled' then 'cancelled'
           when c.amount - c.discount = 0 then 'waived'
           when coalesce(a.paid, 0) >= c.amount - c.discount then 'paid'
           when coalesce(a.paid, 0) > 0 then 'partial'
           else 'open'
         end as state,
         a.last_paid_on
  from public.charges c
  left join (
    select al.charge_id, sum(al.amount) as paid, max(p.received_on) as last_paid_on
    from public.allocations al left join public.payments p on p.id = al.payment_id
    group by al.charge_id
  ) a on a.charge_id = c.id;

create view public.payment_balances with (security_invoker = true) as
  select p.id, p.club_id, p.guardian_id, p.player_id, p.amount, p.method, p.provider, p.provider_ref, p.received_on,
         p.payer_name, p.reference, p.note, p.status, p.refunded_amount, p.created_at,
         coalesce(a.allocated, 0) as allocated,
         case when p.status = 'void' then 0 else p.amount - p.refunded_amount - coalesce(a.allocated, 0) end as unallocated
  from public.payments p
  left join (select al.payment_id, sum(al.amount) as allocated from public.allocations al group by al.payment_id) a
    on a.payment_id = p.id;

-- ---------------------------------------------------------------------------
-- Triggere: updated_at, audit
-- ---------------------------------------------------------------------------
create trigger finance_settings_touch before update on public.finance_settings
  for each row execute function private.touch_updated_at();
create trigger payment_intents_touch before update on public.payment_intents
  for each row execute function private.touch_updated_at();
create trigger purchase_requests_touch before update on public.purchase_requests
  for each row execute function private.touch_updated_at();

do $$
declare t text;
begin
  foreach t in array array[
    'finance_settings', 'fee_plans', 'fee_adjustments', 'charge_requests', 'charges', 'payments', 'allocations',
    'payment_methods', 'receipts', 'bank_statements', 'departments', 'expenses', 'purchase_requests',
    'purchase_request_items', 'budget_lines', 'bonus_rules', 'bonus_entries'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function private.audit()', t || '_audit', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- verificăm acum cheile amânate ale rândurilor inserate mai sus (altfel ALTER TABLE refuză)
set constraints all immediate;

do $$
declare t text;
begin
  foreach t in array array[
    'finance_settings', 'fee_plans', 'fee_adjustments', 'charge_requests', 'charges', 'payments', 'allocations',
    'payment_intents', 'payment_methods', 'provider_events', 'receipts', 'bank_statements', 'bank_lines',
    'departments', 'purchase_requests', 'purchase_request_items', 'expenses', 'budget_lines',
    'bonus_rules', 'bonus_entries'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Citire pentru birou; scrierea trece prin funcții (RPC) unde contează consistența registrului.
grant select on public.finance_settings, public.charges, public.payments, public.allocations, public.payment_intents,
  public.payment_methods, public.receipts, public.bank_statements, public.bank_lines, public.provider_events
to authenticated;
grant select, insert, update, delete on public.fee_plans, public.fee_adjustments, public.charge_requests,
  public.departments, public.expenses, public.budget_lines, public.bonus_rules
to authenticated;
grant select on public.purchase_requests, public.purchase_request_items, public.bonus_entries to authenticated;
grant update (beneficiary, fiscal_code, address, iban, bank_name, issue_day, due_day, reminder_days, fee_months,
  sibling_discount_pct, auto_issue, receipt_prefix, ref_prefix, online_enabled, vat_rates, approver_roles)
  on public.finance_settings to authenticated;
grant select on public.charge_balances, public.payment_balances to authenticated, service_role;

-- setările: biroul financiar le citește și le schimbă; părintele vede datele de transfer printr-o funcție
create policy finance_settings_select on public.finance_settings for select to authenticated
  using (club_id = (select private.my_club()) and (select private.can_see_money_summary()));
create policy finance_settings_update on public.finance_settings for update to authenticated
  using (club_id = (select private.my_club()) and (select private.my_role()) in ('admin', 'accountant'))
  with check (club_id = (select private.my_club()) and (select private.my_role()) in ('admin', 'accountant'));

-- planuri de taxă, reduceri, cereri de plată: biroul financiar
create policy fee_plans_all on public.fee_plans for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_finance()))
  with check (club_id = (select private.my_club()) and (select private.is_finance())
    and (group_id is null or private.group_club(group_id) = club_id)
    and (player_id is null or exists (select 1 from public.players pl where pl.id = player_id and pl.club_id = club_id)));
create policy fee_adjustments_all on public.fee_adjustments for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_finance()))
  with check (club_id = (select private.my_club()) and (select private.is_finance())
    and exists (select 1 from public.players pl where pl.id = player_id and pl.club_id = club_id));
create policy charge_requests_all on public.charge_requests for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_finance()))
  with check (club_id = (select private.my_club()) and (select private.is_finance()));
-- părintele vede titlul cererilor care îl privesc
create policy charge_requests_select_family on public.charge_requests for select to authenticated
  using (club_id = (select private.my_club()) and exists (
    select 1 from public.charges c where c.request_id = charge_requests.id
      and c.player_id = any ((select private.my_player_ids())::uuid[])));

-- taxe: biroul financiar tot; familia (părinte sau jucătorul însuși) doar pe ale ei
create policy charges_select on public.charges for select to authenticated
  using (club_id = (select private.my_club()) and (
    (select private.is_finance())
    or player_id = any ((select private.my_player_ids())::uuid[])));

create policy payments_select on public.payments for select to authenticated
  using (club_id = (select private.my_club()) and (
    (select private.is_finance())
    or guardian_id = any ((select private.my_guardian_ids())::uuid[])
    or (player_id = any ((select private.my_player_ids())::uuid[]) and status = 'completed')));

-- o alocare se vede dacă se vede plata SAU taxa (al doilea părinte vede că taxa copilului e plătită)
create policy allocations_select on public.allocations for select to authenticated
  using (exists (select 1 from public.payments p where p.id = allocations.payment_id)
      or exists (select 1 from public.charges c where c.id = allocations.charge_id));

create policy payment_intents_select on public.payment_intents for select to authenticated
  using (club_id = (select private.my_club()) and (
    (select private.is_finance()) or guardian_id = any ((select private.my_guardian_ids())::uuid[])));

create policy payment_methods_select on public.payment_methods for select to authenticated
  using (club_id = (select private.my_club()) and (
    (select private.is_finance()) or guardian_id = any ((select private.my_guardian_ids())::uuid[])));

create policy provider_events_select on public.provider_events for select to authenticated
  using (club_id = (select private.my_club()) and (select private.my_role()) in ('admin', 'accountant'));

create policy receipts_select on public.receipts for select to authenticated
  using (club_id = (select private.my_club()) and exists (select 1 from public.payments p where p.id = receipts.payment_id));

create policy bank_statements_select on public.bank_statements for select to authenticated
  using (club_id = (select private.my_club()) and (select private.is_finance()));
create policy bank_lines_select on public.bank_lines for select to authenticated
  using (club_id = (select private.my_club()) and (select private.is_finance()));

-- departamente: tot staff-ul le vede (pentru referate); biroul financiar le gestionează
create policy departments_select on public.departments for select to authenticated
  using (club_id = (select private.my_club()) and (select private.is_club_staff()));
create policy departments_write on public.departments for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_finance()))
  with check (club_id = (select private.my_club()) and (select private.is_finance())
    and (parent_id is null or exists (select 1 from public.departments d where d.id = parent_id and d.club_id = club_id)));

create policy expenses_all on public.expenses for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_finance()))
  with check (club_id = (select private.my_club()) and (select private.is_finance())
    and (department_id is null or exists (select 1 from public.departments d where d.id = department_id and d.club_id = club_id))
    and (group_id is null or private.group_club(group_id) = club_id)
    and (player_id is null or exists (select 1 from public.players pl where pl.id = player_id and pl.club_id = club_id))
    and (event_id is null or private.event_club(event_id) = club_id)
    and (purchase_request_id is null or exists (select 1 from public.purchase_requests r where r.id = purchase_request_id and r.club_id = club_id)));

-- referate: autorul le vede pe ale lui; biroul financiar și aprobatorii le văd pe toate
create or replace function private.can_approve_purchases() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select (select private.my_role()) = any (fs.approver_roles)
    from public.finance_settings fs where fs.club_id = (select private.my_club())), false)
$$;

create policy purchase_requests_select on public.purchase_requests for select to authenticated
  using (club_id = (select private.my_club()) and (
    requested_by = (select app_auth.uid()) or (select private.is_finance()) or (select private.can_approve_purchases())
    or (select private.my_role()) = 'sporting_director'));
create policy purchase_request_items_select on public.purchase_request_items for select to authenticated
  using (exists (select 1 from public.purchase_requests r where r.id = purchase_request_items.request_id));

create policy budget_lines_select on public.budget_lines for select to authenticated
  using (club_id = (select private.my_club()) and (select private.can_see_money_summary()));
create policy budget_lines_write on public.budget_lines for all to authenticated
  using (club_id = (select private.my_club()) and (select private.my_role()) in ('admin', 'accountant'))
  with check (club_id = (select private.my_club()) and (select private.my_role()) in ('admin', 'accountant')
    and (department_id is null or exists (select 1 from public.departments d where d.id = department_id and d.club_id = club_id)));

create policy bonus_rules_select on public.bonus_rules for select to authenticated
  using (club_id = (select private.my_club()) and ((select private.is_finance()) or (select private.my_role()) in ('sporting_director', 'owner')));
create policy bonus_rules_write on public.bonus_rules for all to authenticated
  using (club_id = (select private.my_club()) and (select private.my_role()) in ('admin', 'accountant'))
  with check (club_id = (select private.my_club()) and (select private.my_role()) in ('admin', 'accountant')
    and (group_id is null or private.group_club(group_id) = club_id)
    and (competition_id is null or private.competition_club(competition_id) = club_id));
create policy bonus_entries_select on public.bonus_entries for select to authenticated
  using (club_id = (select private.my_club()) and (
    (select private.is_finance()) or (select private.my_role()) in ('sporting_director', 'owner')
    or player_id = any ((select private.my_player_ids())::uuid[])
    or profile_id = (select app_auth.uid())));

-- contabilul vede părinții și legăturile lor (pentru facturare), fără să le poată modifica
create policy guardians_select_finance on public.guardians for select to authenticated
  using (club_id = (select private.my_club()) and (select private.my_role()) = 'accountant');
create policy guardian_players_select_finance on public.guardian_players for select to authenticated
  using (private.guardian_club(guardian_id) = (select private.my_club()) and (select private.my_role()) = 'accountant');
