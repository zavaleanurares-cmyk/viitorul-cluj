-- Locker Room faza 5: migrarea din The Football Brain.
-- Planul îl construiește serverul (packages/shared/src/import/tfb.ts) din fișierele TFB și din starea clubului;
-- funcția de mai jos îl scrie într-o singură tranzacție. Reluarea e sigură: jucătorii existenți se actualizează,
-- legăturile și taxele lunare existente nu se dublează (taxa lunară e unică pe jucător și lună).

alter table public.imports drop constraint if exists imports_kind_check;
alter table public.imports add constraint imports_kind_check
  check (kind in ('health_status', 'fatigue_grid', 'roster', 'physical', 'tests', 'tfb'));

create or replace function public.import_tfb(p jsonb, p_report jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_club uuid := private.my_club();
  v_uid uuid := app_auth.uid();
  v_due smallint;
  v_season uuid;
  v_charge_ids uuid[];
  v_out jsonb := '{}'::jsonb;
  v_n int;
  v_import uuid;
begin
  if v_club is null or coalesce(private.my_role() in ('admin', 'physio'), false) is not true then
    raise exception 'Doar administrarea clubului poate importa din TFB.' using errcode = '42501';
  end if;
  -- o singură migrare odată pe club; un plan făcut înaintea altei migrări (alt tab, alt administrator) e refuzat,
  -- altfel ar crea din nou jucătorii și plățile scrise între timp
  perform pg_advisory_xact_lock(hashtext('import_tfb:' || v_club::text));
  -- `runs_seen` = câte migrări TFB existau când s-a citit starea pentru plan
  if (select count(*) from public.imports i where i.club_id = v_club and i.kind = 'tfb') <> coalesce((p->>'runs_seen')::int, -1) then
    raise exception 'Între timp a rulat o altă migrare din TFB. Reîncarcă pagina și verifică din nou.' using errcode = '40001';
  end if;
  select fs.due_day into v_due from public.finance_settings fs where fs.club_id = v_club;
  v_due := coalesce(v_due, 10);
  select s.id into v_season from public.seasons s where s.club_id = v_club and s.is_current;

  -- echipe
  insert into public.groups (id, club_id, name, sort, birth_year_from, birth_year_to, gender, programme, season_id)
  select x.id, v_club, x.name, x.sort, x.birth_year, x.birth_year, x.gender, x.programme, v_season
  from jsonb_to_recordset(coalesce(p->'groups'->'create', '[]')) as x(id uuid, name text, sort int, birth_year smallint, gender text, programme text)
  on conflict (club_id, name) do nothing;
  get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('groups_created', v_n);

  update public.groups g set name = x.name, is_active = true,
         birth_year_from = coalesce(x.birth_year, g.birth_year_from), birth_year_to = coalesce(x.birth_year, g.birth_year_to),
         gender = coalesce(x.gender, g.gender), programme = coalesce(x.programme, g.programme), season_id = coalesce(g.season_id, v_season)
  from jsonb_to_recordset(coalesce(p->'groups'->'rename', '[]')) as x(id uuid, name text, birth_year smallint, gender text, programme text)
  where g.id = x.id and g.club_id = v_club
    -- numele e deja al altei grupe (de exemplu, una inactivă): grupa își păstrează numele
    and not exists (select 1 from public.groups o where o.club_id = v_club and o.name = x.name and o.id <> g.id);
  get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('groups_renamed', v_n);

  -- jucători noi (grupa trebuie să fie a clubului)
  insert into public.players (id, club_id, group_id, full_name, display_name, birth_date, position, position_detail, shirt_number,
                              medical_visa_expires_on, registration_number, enrolled_on, is_active)
  select x.id, v_club, g.id, x.full_name, coalesce(x.display_name, x.full_name), x.birth_date, x.position, x.position_detail, x.shirt_number,
         x.medical_visa_expires_on, x.registration_number, x.enrolled_on, x.is_active
  from jsonb_to_recordset(coalesce(p->'players'->'create', '[]')) as x(id uuid, group_id uuid, full_name text, display_name text, birth_date date,
         position text, position_detail text, shirt_number smallint, medical_visa_expires_on date, registration_number text, enrolled_on date, is_active boolean)
  left join public.groups g on g.id = x.group_id and g.club_id = v_club;
  get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('players_created', v_n);

  -- jucători existenți: TFB completează și corectează; numele scurt rămâne al clubului
  update public.players pl set
         group_id = coalesce(g.id, pl.group_id),
         full_name = x.full_name,
         birth_date = coalesce(x.birth_date, pl.birth_date),
         position = coalesce(x.position, pl.position),
         position_detail = coalesce(x.position_detail, pl.position_detail),
         shirt_number = coalesce(x.shirt_number, pl.shirt_number),
         medical_visa_expires_on = coalesce(x.medical_visa_expires_on, pl.medical_visa_expires_on),
         registration_number = coalesce(x.registration_number, pl.registration_number),
         enrolled_on = coalesce(pl.enrolled_on, x.enrolled_on),
         is_active = pl.is_active or x.is_active
  from jsonb_to_recordset(coalesce(p->'players'->'update', '[]')) as x(id uuid, group_id uuid, full_name text, birth_date date, position text,
         position_detail text, shirt_number smallint, medical_visa_expires_on date, registration_number text, enrolled_on date, is_active boolean)
  left join public.groups g on g.id = x.group_id and g.club_id = v_club
  where pl.id = x.id and pl.club_id = v_club and pl.anonymized_at is null;
  get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('players_updated', v_n);

  update public.players pl set is_active = false
  where pl.club_id = v_club and pl.id in (select (jsonb_array_elements_text(coalesce(p->'players'->'deactivate', '[]')))::uuid);
  get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('players_deactivated', v_n);

  -- părinți și legături (o legătură existentă își păstrează rolul de plătitor)
  insert into public.guardians (id, club_id, full_name, phone, email)
  select x.id, v_club, x.full_name, x.phone, x.email
  from jsonb_to_recordset(coalesce(p->'guardians'->'create', '[]')) as x(id uuid, full_name text, phone text, email text);
  get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('guardians_created', v_n);

  insert into public.guardian_players (guardian_id, player_id, relation, is_billing)
  select gd.id, pl.id, x.relation, x.is_billing
  from jsonb_to_recordset(coalesce(p->'guardians'->'link', '[]')) as x(guardian_id uuid, player_id uuid, relation text, is_billing boolean)
  join public.guardians gd on gd.id = x.guardian_id and gd.club_id = v_club
  join public.players pl on pl.id = x.player_id and pl.club_id = v_club
  on conflict (guardian_id, player_id) do nothing;
  get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('links', v_n);

  insert into public.player_contacts (player_id, phone, email)
  select distinct on (pl.id) pl.id, x.phone, x.email
  from jsonb_to_recordset(coalesce(p->'contacts', '[]')) as x(player_id uuid, phone text, email text)
  join public.players pl on pl.id = x.player_id and pl.club_id = v_club
  order by pl.id
  on conflict (player_id) do update set phone = coalesce(public.player_contacts.phone, excluded.phone),
                                        email = coalesce(public.player_contacts.email, excluded.email), updated_at = now();
  get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('contacts', v_n);

  -- taxa lunară în vigoare
  insert into public.fee_plans (club_id, group_id, player_id, amount, valid_from, reason, created_by)
  select v_club, g.id, pl.id, x.amount, x.valid_from, 'Import TFB', v_uid
  from jsonb_to_recordset(coalesce(p->'feePlans', '[]')) as x(group_id uuid, player_id uuid, amount bigint, valid_from date)
  left join public.groups g on g.id = x.group_id and g.club_id = v_club
  left join public.players pl on pl.id = x.player_id and pl.club_id = v_club
  where (g.id is null) <> (pl.id is null);
  get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('fee_plans', v_n);

  -- istoricul: taxele lunare (o singură dată pe jucător și lună), apoi plățile și alocările lor
  with ins as (
    insert into public.charges (id, club_id, player_id, guardian_id, kind, period, title, amount, due_on, created_by)
    select x.id, v_club, pl.id, gd.id, 'monthly', x.period, 'Taxă lunară ' || private.month_ro(x.period), x.amount,
           make_date(extract(year from x.period)::int, extract(month from x.period)::int, v_due), v_uid
    from jsonb_to_recordset(coalesce(p->'charges', '[]')) as x(id uuid, player_id uuid, guardian_id uuid, period date, amount bigint)
    join public.players pl on pl.id = x.player_id and pl.club_id = v_club
    left join public.guardians gd on gd.id = x.guardian_id and gd.club_id = v_club
    on conflict do nothing
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_charge_ids from ins;
  v_out := v_out || jsonb_build_object('charges', cardinality(v_charge_ids));

  with src as (
    select gen_random_uuid() as pay_id, x.*
    from jsonb_to_recordset(coalesce(p->'payments', '[]')) as x(charge_id uuid, player_id uuid, guardian_id uuid, amount bigint, method text, received_on date, note text)
    where x.charge_id = any (v_charge_ids)
  ), pay as (
    insert into public.payments (id, club_id, guardian_id, player_id, amount, method, provider, received_on, note, reference, recorded_by)
    select s.pay_id, v_club, (select gd.id from public.guardians gd where gd.id = s.guardian_id and gd.club_id = v_club), s.player_id, s.amount, s.method,
           case when s.method = 'online' then 'tfb' end, s.received_on, s.note, 'TFB', v_uid
    from src s
    returning id
  )
  insert into public.allocations (payment_id, charge_id, amount, created_by)
  select s.pay_id, s.charge_id, s.amount, v_uid from src s;
  get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('payments', v_n);

  -- plăți TFB pentru luni care au deja taxă (emisă din Locker Room): o singură dată pe taxă și doar cât mai e de plată
  with src as (
    select gen_random_uuid() as pay_id, c.id as charge_id, coalesce(c.guardian_id, x.guardian_id) as guardian_id, x.player_id, x.amount, x.method, x.received_on, x.note
    from jsonb_to_recordset(coalesce(p->'paymentsExisting', '[]')) as x(player_id uuid, guardian_id uuid, period date, amount bigint, method text, received_on date, note text)
    join public.charges c on c.club_id = v_club and c.player_id = x.player_id and c.kind = 'monthly' and c.period = x.period and c.status <> 'cancelled'
    where not exists (select 1 from public.allocations a join public.payments py on py.id = a.payment_id
                      where a.charge_id = c.id and py.reference = 'TFB' and py.status = 'completed')
      and c.amount - coalesce((select sum(a.amount) from public.allocations a join public.payments py on py.id = a.payment_id
                               where a.charge_id = c.id and py.status = 'completed'), 0) >= x.amount
  ), pay as (
    insert into public.payments (id, club_id, guardian_id, player_id, amount, method, provider, received_on, note, reference, recorded_by)
    select s.pay_id, v_club, (select gd.id from public.guardians gd where gd.id = s.guardian_id and gd.club_id = v_club), s.player_id, s.amount, s.method,
           case when s.method = 'online' then 'tfb' end, s.received_on, s.note, 'TFB', v_uid
    from src s
    returning id
  )
  insert into public.allocations (payment_id, charge_id, amount, created_by)
  select s.pay_id, s.charge_id, s.amount, v_uid from src s;
  get diagnostics v_n = row_count; v_out := v_out || jsonb_build_object('payments_existing', v_n);

  insert into public.imports (club_id, kind, filename, report, rows_imported, rows_skipped, created_by)
  values (v_club, 'tfb', 'The Football Brain', coalesce(p_report, '{}'::jsonb) || jsonb_build_object('written', v_out),
          coalesce((v_out->>'players_created')::int, 0) + coalesce((v_out->>'players_updated')::int, 0), 0, v_uid)
  returning id into v_import;
  insert into public.audit_log (club_id, actor_id, actor_role, action, entity, entity_id, details)
  values (v_club, v_uid, (select private.my_role())::text, 'IMPORT', 'imports', v_import::text, jsonb_build_object('kind', 'tfb') || v_out);
  return v_out || jsonb_build_object('import_id', v_import);
end $$;

revoke all on function public.import_tfb(jsonb, jsonb) from public, anon;
grant execute on function public.import_tfb(jsonb, jsonb) to authenticated;
