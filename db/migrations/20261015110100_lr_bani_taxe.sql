-- Locker Room · faza 3 · Bani: taxe, plăți, chitanțe, plăți online.
-- Toate funcțiile care scriu în registru (charges / payments / allocations) sunt aici; tabelele nu se scriu direct.
set local check_function_bodies = off;

alter table public.bank_lines add column note text;

-- ---------------------------------------------------------------------------
-- Ajutoare
-- ---------------------------------------------------------------------------
create or replace function private.month_ro(p date) returns text
language sql immutable set search_path = '' as $$
  select (array['ianuarie','februarie','martie','aprilie','mai','iunie','iulie','august','septembrie','octombrie','noiembrie','decembrie'])
         [extract(month from p)::int] || ' ' || extract(year from p)::int
$$;

create or replace function private.lei(p bigint) returns text
language sql immutable set search_path = '' as $$
  select replace(replace(replace(to_char(p / 100.0, 'FM999G999G990D00'), ',', '#'), '.', ','), '#', '.') || ' lei'
$$;

-- Părintele care plătește pentru un jucător: cel marcat „plătitor", altfel primul legat de el.
create or replace function private.billing_guardian(p_player uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select gp.guardian_id from public.guardian_players gp
  join public.guardians g on g.id = gp.guardian_id and g.deleted_at is null
  where gp.player_id = p_player
  order by gp.is_billing desc, g.created_at, g.id
  limit 1
$$;

-- Taxa lunară în vigoare pentru un jucător într-o lună: planul lui, altfel planul echipei.
create or replace function private.effective_fee(p_player uuid, p_period date) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select fp.amount from public.fee_plans fp
      where fp.player_id = p_player and fp.deleted_at is null
        and fp.valid_from <= p_period and (fp.valid_to is null or fp.valid_to >= p_period)
      order by fp.valid_from desc, fp.created_at desc limit 1),
    (select fp.amount from public.fee_plans fp join public.players pl on pl.group_id = fp.group_id
      where pl.id = p_player and fp.deleted_at is null
        and fp.valid_from <= p_period and (fp.valid_to is null or fp.valid_to >= p_period)
      order by fp.valid_from desc, fp.created_at desc limit 1))
$$;

-- Familia unei plăți: jucătorii părintelui (sau jucătorul plății).
create or replace function private.payment_family_players(p_payment uuid) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct x.pid), '{}'::uuid[]) from (
    select p.player_id as pid from public.payments p where p.id = p_payment and p.player_id is not null
    union
    select gp.player_id from public.payments p join public.guardian_players gp on gp.guardian_id = p.guardian_id
    where p.id = p_payment
  ) x
$$;

create or replace function private.notify_guardian(p_guardian uuid, p_kind text, p_title text, p_body text, p_link text, p_key text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  select g.user_id into v_user from public.guardians g where g.id = p_guardian and g.deleted_at is null;
  if v_user is null then return; end if;
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  values (v_user, p_kind, p_title, p_body, p_link, p_key)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- Alocare automată: cele mai vechi taxe deschise ale familiei, până se termină plata
-- ---------------------------------------------------------------------------
create or replace function private.auto_allocate(p_payment uuid, p_only uuid[] default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_left bigint; v_take bigint; r record;
  v_players uuid[] := private.payment_family_players(p_payment);
begin
  select pb.unallocated into v_left from public.payment_balances pb where pb.id = p_payment;
  if coalesce(v_left, 0) <= 0 then return 0; end if;
  for r in
    select cb.id, cb.balance from public.charge_balances cb
    where cb.status = 'open' and cb.balance > 0
      and cb.club_id = (select p.club_id from public.payments p where p.id = p_payment)
      and (case when p_only is not null then cb.id = any (p_only) else cb.player_id = any (v_players) end)
    order by case when p_only is not null then array_position(p_only, cb.id) end, cb.due_on, cb.period nulls last, cb.issued_at
  loop
    exit when v_left <= 0;
    v_take := least(v_left, r.balance);
    insert into public.allocations (payment_id, charge_id, amount, created_by)
    values (p_payment, r.id, v_take, app_auth.uid())
    on conflict (payment_id, charge_id) do update set amount = public.allocations.amount + excluded.amount;
    v_left := v_left - v_take;
  end loop;
  return v_left;
end $$;

-- ---------------------------------------------------------------------------
-- Chitanța unei plăți în numerar
-- ---------------------------------------------------------------------------
create or replace function private.issue_receipt(p_payment uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_p record; v_fs record; v_desc text; v_payer text; v_id uuid; v_year int;
begin
  select * into v_p from public.payments where id = p_payment;
  if v_p.method <> 'cash' then return null; end if;
  select id into v_id from public.receipts where payment_id = p_payment;
  if v_id is not null then return v_id; end if;
  select * into v_fs from public.finance_settings where club_id = v_p.club_id;
  v_year := extract(year from v_p.received_on)::int;
  select string_agg(c.title || ' – ' || pl.full_name, '; ' order by c.due_on, pl.full_name) into v_desc
  from public.allocations a join public.charges c on c.id = a.charge_id join public.players pl on pl.id = c.player_id
  where a.payment_id = p_payment;
  v_payer := coalesce(nullif(trim(v_p.payer_name), ''), (select g.full_name from public.guardians g where g.id = v_p.guardian_id),
                      (select pl.full_name from public.players pl where pl.id = v_p.player_id), 'Plătitor');
  insert into public.receipts (club_id, payment_id, series, number, issued_on, payer_name, amount, description, issued_by)
  values (v_p.club_id, p_payment, coalesce(v_fs.receipt_prefix, 'CH') || v_year::text,
          private.next_counter(v_p.club_id, 'receipt:' || v_year::text, 1)::int,
          v_p.received_on, v_payer, v_p.amount, coalesce(v_desc, 'Avans în contul taxelor'), app_auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Emiterea taxelor lunare (de mână, de biroul financiar, sau zilnic, de sarcina programată)
-- ---------------------------------------------------------------------------
create or replace function public.issue_monthly_charges(p_period date, p_club uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_service boolean := app_auth.uid() is null;
  v_club uuid; v_fs record; v_period date := date_trunc('month', p_period)::date;
  r record; v_amount bigint; v_discount bigint; v_note text; v_adj record; v_sib int;
  v_created int := 0; v_total bigint := 0; v_noplan int := 0; v_g record;
begin
  if v_service then
    v_club := p_club;
    if v_club is null then raise exception 'Clubul lipsește.'; end if;
  else
    if not private.is_finance() then raise exception 'Doar biroul emite taxe.' using errcode = '42501'; end if;
    v_club := private.my_club();
  end if;
  select * into v_fs from public.finance_settings where club_id = v_club;
  if v_fs is null then raise exception 'Setările financiare lipsesc.'; end if;
  if not (extract(month from v_period)::smallint = any (v_fs.fee_months)) then
    return jsonb_build_object('created', 0, 'total', 0, 'skipped_month', true);
  end if;

  for r in
    select pl.id, pl.group_id, pl.birth_date, pl.full_name, private.billing_guardian(pl.id) as guardian_id
    from public.players pl
    where pl.club_id = v_club and pl.is_active and pl.anonymized_at is null
      and (pl.enrolled_on is null or pl.enrolled_on < (v_period + interval '1 month')::date)
      and not exists (select 1 from public.charges c where c.player_id = pl.id and c.kind = 'monthly'
                      and c.period = v_period and c.status <> 'cancelled')
    order by pl.full_name
  loop
    v_amount := private.effective_fee(r.id, v_period);
    if v_amount is null or v_amount = 0 then v_noplan := v_noplan + 1; continue; end if;
    v_discount := 0; v_note := null;
    for v_adj in
      select a.* from public.fee_adjustments a
      where a.player_id = r.id and a.deleted_at is null
        and a.from_month <= v_period and (a.to_month is null or a.to_month >= v_period)
      order by a.created_at
    loop
      v_discount := v_discount + case v_adj.kind
        when 'waiver' then v_amount
        when 'percent' then round(v_amount * v_adj.value / 100.0)::bigint
        else v_adj.value end;
      v_note := concat_ws('; ', v_note, case v_adj.reason
        when 'sibling' then 'reducere frați' when 'scholarship' then 'bursă' when 'injury' then 'accidentare'
        when 'pause' then 'pauză' when 'staff_child' then 'copil de angajat' else coalesce(v_adj.note, 'reducere') end);
    end loop;
    -- reducerea automată de frați: al doilea copil (și următorii) al aceluiași plătitor, dacă nu are altă reducere
    if v_note is null and v_fs.sibling_discount_pct > 0 and r.guardian_id is not null then
      select count(*) into v_sib from public.players o
      where o.id <> r.id and o.club_id = v_club and o.is_active and o.anonymized_at is null
        and private.billing_guardian(o.id) = r.guardian_id
        and private.effective_fee(o.id, v_period) > 0
        and (o.birth_date < r.birth_date or (o.birth_date is not distinct from r.birth_date and o.id < r.id)
             or (r.birth_date is null and o.birth_date is not null));
      if v_sib >= 1 then
        v_discount := round(v_amount * v_fs.sibling_discount_pct / 100.0)::bigint;
        v_note := 'reducere frați ' || v_fs.sibling_discount_pct || '%';
      end if;
    end if;
    v_discount := least(v_discount, v_amount);
    insert into public.charges (club_id, player_id, guardian_id, kind, period, title, amount, discount, discount_note, due_on, created_by)
    values (v_club, r.id, r.guardian_id, 'monthly', v_period, 'Taxă lunară ' || private.month_ro(v_period),
            v_amount, v_discount, v_note,
            make_date(extract(year from v_period)::int, extract(month from v_period)::int, v_fs.due_day), app_auth.uid());
    v_created := v_created + 1;
    v_total := v_total + v_amount - v_discount;
  end loop;

  -- un singur anunț pe familie, cu suma totală
  for v_g in
    select c.guardian_id, sum(c.amount - c.discount) as net, min(c.due_on) as due
    from public.charges c
    where c.club_id = v_club and c.kind = 'monthly' and c.period = v_period and c.status = 'open'
      and c.guardian_id is not null and c.amount > c.discount
    group by c.guardian_id
  loop
    perform private.notify_guardian(v_g.guardian_id, 'fee_issued',
      'Taxa pe ' || private.month_ro(v_period),
      private.lei(v_g.net) || ' · scadentă pe ' || to_char(v_g.due, 'DD.MM.YYYY'),
      '/plati', 'fee:' || v_period::text);
  end loop;

  return jsonb_build_object('created', v_created, 'total', v_total, 'no_plan', v_noplan);
end $$;

-- Ce s-ar emite luna asta, fără să scrie nimic (pentru ecranul „Pe pilot automat").
create or replace function public.preview_monthly_charges(p_period date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); v_period date := date_trunc('month', p_period)::date; v_n int; v_sum bigint; v_disc int;
begin
  if not private.is_finance() then raise exception 'Doar biroul vede taxele.' using errcode = '42501'; end if;
  select count(*), coalesce(sum(private.effective_fee(pl.id, v_period)), 0)
    into v_n, v_sum
  from public.players pl
  where pl.club_id = v_club and pl.is_active and pl.anonymized_at is null
    and coalesce(private.effective_fee(pl.id, v_period), 0) > 0
    and not exists (select 1 from public.charges c where c.player_id = pl.id and c.kind = 'monthly' and c.period = v_period and c.status <> 'cancelled');
  select count(distinct a.player_id) into v_disc from public.fee_adjustments a
  where a.club_id = v_club and a.deleted_at is null and a.from_month <= v_period and (a.to_month is null or a.to_month >= v_period);
  return jsonb_build_object('count', v_n, 'gross', v_sum, 'adjusted_players', v_disc);
end $$;

-- ---------------------------------------------------------------------------
-- Mementouri pe 5, 15, 25 (sau cum e setat), doar familiilor cu taxe restante
-- ---------------------------------------------------------------------------
create or replace function public.send_fee_reminders() returns int
language plpgsql security definer set search_path = '' as $$
declare v_club record; v_today date; v_g record; v_n int := 0;
begin
  for v_club in select fs.club_id, fs.reminder_days from public.finance_settings fs loop
    v_today := private.club_today(v_club.club_id);
    if not (extract(day from v_today)::smallint = any (v_club.reminder_days)) then continue; end if;
    for v_g in
      select cb.guardian_id, sum(cb.balance) as due, count(*) as n
      from public.charge_balances cb
      where cb.club_id = v_club.club_id and cb.guardian_id is not null and cb.balance > 0
        and cb.state in ('open', 'partial') and cb.due_on < v_today
      group by cb.guardian_id
    loop
      perform private.notify_guardian(v_g.guardian_id, 'fee_reminder', 'Ai de plătit ' || private.lei(v_g.due),
        case when v_g.n = 1 then 'O taxă a trecut de scadență.' else v_g.n || ' taxe au trecut de scadență.' end,
        '/plati', 'fee-reminder:' || v_today::text);
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end $$;

-- ---------------------------------------------------------------------------
-- Plăți înregistrate de birou (numerar, transfer, POS)
-- ---------------------------------------------------------------------------
create or replace function public.record_payment(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_club uuid := private.my_club();
  v_method text := p->>'method';
  v_amount bigint := (p->>'amount')::bigint;
  v_guardian uuid := nullif(p->>'guardian_id', '')::uuid;
  v_player uuid := nullif(p->>'player_id', '')::uuid;
  v_line uuid := nullif(p->>'bank_line_id', '')::uuid;
  v_id uuid; v_receipt uuid; v_left bigint; r jsonb;
begin
  if not private.is_finance() then raise exception 'Doar biroul înregistrează plăți.' using errcode = '42501'; end if;
  if v_method not in ('cash', 'bank', 'card') then raise exception 'Mod de plată necunoscut.'; end if;
  if v_amount is null or v_amount <= 0 then raise exception 'Suma trebuie să fie mai mare decât zero.'; end if;
  if v_guardian is not null and private.guardian_club(v_guardian) is distinct from v_club then raise exception 'Părinte necunoscut.' using errcode = '42501'; end if;
  if v_player is not null and not exists (select 1 from public.players where id = v_player and club_id = v_club) then
    raise exception 'Jucător necunoscut.' using errcode = '42501';
  end if;
  if v_line is not null and not exists (select 1 from public.bank_lines where id = v_line and club_id = v_club and status = 'unmatched' and amount = v_amount) then
    raise exception 'Rândul din extras nu se potrivește.';
  end if;
  insert into public.payments (club_id, guardian_id, player_id, amount, method, received_on, payer_name, reference, note, recorded_by)
  values (v_club, v_guardian, v_player, v_amount, v_method,
          coalesce(nullif(p->>'received_on', '')::date, private.club_today(v_club)),
          nullif(trim(p->>'payer_name'), ''), nullif(trim(p->>'reference'), ''), nullif(trim(p->>'note'), ''), app_auth.uid())
  returning id into v_id;

  if jsonb_typeof(p->'allocations') = 'array' and jsonb_array_length(p->'allocations') > 0 then
    for r in select * from jsonb_array_elements(p->'allocations') loop
      if not exists (select 1 from public.charges c where c.id = (r->>'charge_id')::uuid and c.club_id = v_club) then
        raise exception 'Taxă necunoscută.' using errcode = '42501';
      end if;
      insert into public.allocations (payment_id, charge_id, amount, created_by)
      values (v_id, (r->>'charge_id')::uuid, (r->>'amount')::bigint, app_auth.uid());
    end loop;
    select pb.unallocated into v_left from public.payment_balances pb where pb.id = v_id;
  else
    v_left := private.auto_allocate(v_id);
  end if;
  if v_line is not null then
    update public.bank_lines set status = 'matched', payment_id = v_id, matched_by = app_auth.uid(), matched_at = now() where id = v_line;
  end if;
  v_receipt := private.issue_receipt(v_id);
  return jsonb_build_object('payment_id', v_id, 'receipt_id', v_receipt, 'unallocated', coalesce(v_left, 0));
end $$;

-- Împarte (din nou) o plată: înlocuiește alocările. Folosit din „Plăți de asociat".
create or replace function public.allocate_payment(p_payment uuid, p_rows jsonb, p_guardian uuid default null, p_player uuid default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); v_p record; r jsonb; v_left bigint;
begin
  if not private.is_finance() then raise exception 'Doar biroul împarte plățile.' using errcode = '42501'; end if;
  select * into v_p from public.payments where id = p_payment and club_id = v_club;
  if v_p is null then raise exception 'Plată necunoscută.' using errcode = '42501'; end if;
  if v_p.status = 'void' then raise exception 'Plata este anulată.'; end if;
  if p_guardian is not null and private.guardian_club(p_guardian) is distinct from v_club then raise exception 'Părinte necunoscut.' using errcode = '42501'; end if;
  if p_player is not null and not exists (select 1 from public.players where id = p_player and club_id = v_club) then raise exception 'Jucător necunoscut.' using errcode = '42501'; end if;
  update public.payments set guardian_id = coalesce(p_guardian, guardian_id), player_id = coalesce(p_player, player_id) where id = p_payment;
  delete from public.allocations where payment_id = p_payment;
  if jsonb_typeof(p_rows) = 'array' and jsonb_array_length(p_rows) > 0 then
    for r in select * from jsonb_array_elements(p_rows) loop
      if (r->>'amount')::bigint <= 0 then continue; end if;
      if not exists (select 1 from public.charges c where c.id = (r->>'charge_id')::uuid and c.club_id = v_club) then
        raise exception 'Taxă necunoscută.' using errcode = '42501';
      end if;
      insert into public.allocations (payment_id, charge_id, amount, created_by)
      values (p_payment, (r->>'charge_id')::uuid, (r->>'amount')::bigint, app_auth.uid());
    end loop;
  else
    perform private.auto_allocate(p_payment);
  end if;
  -- chitanța unei plăți în numerar se reface doar dacă nu are încă una
  perform private.issue_receipt(p_payment);
  select pb.unallocated into v_left from public.payment_balances pb where pb.id = p_payment;
  return v_left;
end $$;

-- Anulează o plată înregistrată greșit (nu și una online: aceea se returnează prin operator).
create or replace function public.void_payment(p_payment uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_p record;
begin
  if not private.is_finance() then raise exception 'Doar biroul anulează plăți.' using errcode = '42501'; end if;
  select * into v_p from public.payments where id = p_payment and club_id = private.my_club();
  if v_p is null then raise exception 'Plată necunoscută.' using errcode = '42501'; end if;
  if v_p.method = 'online' then raise exception 'O plată online se returnează, nu se anulează.'; end if;
  if v_p.status = 'void' then return; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Scrie motivul anulării.'; end if;
  delete from public.allocations where payment_id = p_payment;
  update public.payments set status = 'void', void_reason = trim(p_reason) where id = p_payment;
  update public.receipts set cancelled_at = now(), cancel_reason = trim(p_reason) where payment_id = p_payment and cancelled_at is null;
  update public.bank_lines set status = 'unmatched', payment_id = null, matched_by = null, matched_at = null where payment_id = p_payment;
end $$;

-- ---------------------------------------------------------------------------
-- Taxe: anulare, reducere pe o singură taxă, cereri de plată
-- ---------------------------------------------------------------------------
create or replace function public.cancel_charge(p_charge uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_finance() then raise exception 'Doar biroul anulează taxe.' using errcode = '42501'; end if;
  if not exists (select 1 from public.charges where id = p_charge and club_id = private.my_club()) then
    raise exception 'Taxă necunoscută.' using errcode = '42501';
  end if;
  if exists (select 1 from public.allocations where charge_id = p_charge) then
    raise exception 'Taxa are plăți. Mută întâi plățile pe altă taxă.';
  end if;
  update public.charges set status = 'cancelled', cancel_reason = nullif(trim(p_reason), '') where id = p_charge;
end $$;

create or replace function public.set_charge_discount(p_charge uuid, p_discount bigint, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_c record;
begin
  if not private.is_finance() then raise exception 'Doar biroul acordă reduceri.' using errcode = '42501'; end if;
  select * into v_c from public.charge_balances where id = p_charge and club_id = private.my_club();
  if v_c is null then raise exception 'Taxă necunoscută.' using errcode = '42501'; end if;
  if p_discount < 0 or p_discount > v_c.amount then raise exception 'Reducerea trebuie să fie între 0 și suma taxei.'; end if;
  if v_c.amount - p_discount < v_c.paid then raise exception 'S-a plătit deja mai mult decât ar rămâne de plată.'; end if;
  update public.charges set discount = p_discount, discount_note = nullif(trim(p_note), '') where id = p_charge;
end $$;

create or replace function public.save_charge_request(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_club uuid := private.my_club();
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_amount bigint := (p->>'amount')::bigint;
  v_due date := (p->>'due_on')::date;
  v_title text := trim(coalesce(p->>'title', ''));
  v_kind text := coalesce(nullif(p->>'kind', ''), 'one_off');
  v_players uuid[] := coalesce(array(select jsonb_array_elements_text(coalesce(p->'player_ids', '[]'))::uuid), '{}');
  v_pid uuid; v_created int := 0; v_g uuid;
begin
  if not private.is_finance() then raise exception 'Doar biroul cere plăți.' using errcode = '42501'; end if;
  if v_title = '' then raise exception 'Scrie pentru ce este plata.'; end if;
  if v_amount is null or v_amount <= 0 then raise exception 'Suma trebuie să fie mai mare decât zero.'; end if;
  if v_due is null then raise exception 'Alege data scadentă.'; end if;
  if exists (select 1 from unnest(v_players) x where not exists (select 1 from public.players pl where pl.id = x and pl.club_id = v_club)) then
    raise exception 'Jucător necunoscut.' using errcode = '42501';
  end if;
  if v_id is null then
    insert into public.charge_requests (club_id, title, description, kind, amount, due_on, created_by)
    values (v_club, v_title, nullif(trim(p->>'description'), ''), v_kind, v_amount, v_due, app_auth.uid())
    returning id into v_id;
  else
    if not exists (select 1 from public.charge_requests where id = v_id and club_id = v_club and deleted_at is null) then
      raise exception 'Cerere necunoscută.' using errcode = '42501';
    end if;
    update public.charge_requests set title = v_title, description = nullif(trim(p->>'description'), ''), kind = v_kind,
      amount = v_amount, due_on = v_due where id = v_id;
    -- taxele încă neplătite urmează cererea
    update public.charges c set title = v_title, amount = v_amount, discount = least(c.discount, v_amount), due_on = v_due
    where c.request_id = v_id and c.status = 'open' and not exists (select 1 from public.allocations a where a.charge_id = c.id);
  end if;
  foreach v_pid in array v_players loop
    if exists (select 1 from public.charges c where c.request_id = v_id and c.player_id = v_pid and c.status = 'open') then continue; end if;
    v_g := private.billing_guardian(v_pid);
    insert into public.charges (club_id, player_id, guardian_id, kind, request_id, title, amount, due_on, created_by)
    values (v_club, v_pid, v_g, v_kind, v_id, v_title, v_amount, v_due, app_auth.uid());
    v_created := v_created + 1;
    if v_g is not null then
      perform private.notify_guardian(v_g, 'charge_request', v_title, private.lei(v_amount) || ' · scadentă pe ' || to_char(v_due, 'DD.MM.YYYY'),
        '/plati', 'charge:' || v_id::text || ':' || v_pid::text);
    end if;
  end loop;
  return jsonb_build_object('id', v_id, 'created', v_created);
end $$;

-- ---------------------------------------------------------------------------
-- Plăți online: intenția (părintele), aplicarea evenimentelor operatorului (doar serverul)
-- ---------------------------------------------------------------------------
create or replace function public.create_payment_intent(p_charge_ids uuid[], p_save_method boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_club uuid := private.my_club(); v_fs record; v_amount bigint; v_n int; v_guardian uuid; v_players uuid[]; v_id uuid;
begin
  if app_auth.uid() is null or v_club is null then raise exception 'Sesiune invalidă.' using errcode = '42501'; end if;
  select * into v_fs from public.finance_settings where club_id = v_club;
  if not v_fs.online_enabled then raise exception 'Plata online nu este pornită la acest club.'; end if;
  if coalesce(cardinality(p_charge_ids), 0) = 0 then raise exception 'Alege ce plătești.'; end if;
  select count(*), coalesce(sum(cb.balance), 0), array_agg(distinct cb.player_id)
    into v_n, v_amount, v_players
  from public.charge_balances cb
  where cb.id = any (p_charge_ids) and cb.club_id = v_club and cb.status = 'open' and cb.balance > 0
    and (cb.player_id = any (private.my_player_ids()) or private.is_finance());
  if v_n <> cardinality(p_charge_ids) then raise exception 'Una dintre taxe nu mai este de plătit.'; end if;
  select gp.guardian_id into v_guardian from public.guardian_players gp
  where gp.guardian_id = any (private.my_guardian_ids()) and gp.player_id = any (v_players)
  order by gp.is_billing desc limit 1;
  insert into public.payment_intents (club_id, guardian_id, player_id, provider, amount, charge_ids, save_method, created_by)
  values (v_club, v_guardian, case when cardinality(v_players) = 1 then v_players[1] end, v_fs.provider, v_amount,
          p_charge_ids, coalesce(p_save_method, false) and v_guardian is not null, app_auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'amount', v_amount, 'provider', v_fs.provider, 'currency', v_fs.currency, 'guardian_id', v_guardian);
end $$;

create or replace function public.attach_intent_checkout(p_intent uuid, p_provider_ref text, p_url text) returns void
language sql security definer set search_path = '' as $$
  update public.payment_intents set provider_ref = p_provider_ref, checkout_url = p_url, status = 'pending'
  where id = p_intent and status in ('created', 'pending');
$$;

-- Un eveniment al operatorului, deja verificat de adaptor. Idempotent: același eveniment a doua oară nu schimbă nimic.
--   p = { provider, event_id, type: payment.succeeded | payment.failed | refund.succeeded,
--         intent_id?, intent_ref?, payment_ref, amount, occurred_at, method?: { ref, label }, reason? }
create or replace function public.apply_provider_event(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_provider text := p->>'provider'; v_type text := p->>'type'; v_evt uuid; v_done timestamptz;
  v_intent record; v_pay record; v_id uuid; v_left bigint; v_refund bigint; v_free bigint; a record; v_today date; v_club uuid;
begin
  insert into public.provider_events (provider, event_id, type, payload)
  values (v_provider, p->>'event_id', v_type, p)
  on conflict (provider, event_id) do nothing
  returning id into v_evt;
  if v_evt is null then
    select processed_at into v_done from public.provider_events where provider = v_provider and event_id = p->>'event_id';
    if v_done is not null then return jsonb_build_object('status', 'duplicate'); end if;
    select id into v_evt from public.provider_events where provider = v_provider and event_id = p->>'event_id';
  end if;

  select * into v_intent from public.payment_intents
  where (id = nullif(p->>'intent_id', '')::uuid) or (provider = v_provider and provider_ref = nullif(p->>'intent_ref', ''))
  limit 1;

  if v_type = 'payment.succeeded' then
    if v_intent is null then raise exception 'Plată fără intenție cunoscută.'; end if;
    select id into v_id from public.payments where provider = v_provider and provider_ref = p->>'payment_ref';
    if v_id is null then
      v_today := ((p->>'occurred_at')::timestamptz at time zone coalesce(
        (select c.settings->>'timezone' from public.clubs c where c.id = v_intent.club_id), 'Europe/Bucharest'))::date;
      insert into public.payments (club_id, guardian_id, player_id, amount, method, provider, provider_ref, received_on, payer_name, reference)
      values (v_intent.club_id, v_intent.guardian_id, v_intent.player_id, (p->>'amount')::bigint, 'online', v_provider,
              p->>'payment_ref', v_today, (select g.full_name from public.guardians g where g.id = v_intent.guardian_id),
              'Plată în aplicație')
      returning id into v_id;
      v_left := private.auto_allocate(v_id, v_intent.charge_ids);
      if v_intent.save_method and jsonb_typeof(p->'method') = 'object' and v_intent.guardian_id is not null then
        update public.payment_methods set revoked_at = now() where guardian_id = v_intent.guardian_id and revoked_at is null
          and provider_ref <> p->'method'->>'ref';
        insert into public.payment_methods (club_id, guardian_id, provider, provider_ref, label)
        values (v_intent.club_id, v_intent.guardian_id, v_provider, p->'method'->>'ref', coalesce(p->'method'->>'label', 'Card salvat'))
        on conflict (provider, provider_ref) do update set revoked_at = null, label = excluded.label;
      end if;
      if v_intent.guardian_id is not null then
        perform private.notify_guardian(v_intent.guardian_id, 'payment_received', 'Am primit plata',
          private.lei((p->>'amount')::bigint) || ', mulțumim.', '/plati', 'payment:' || v_id::text);
      end if;
    end if;
    update public.payment_intents set status = 'succeeded', payment_id = v_id where id = v_intent.id;
    v_club := v_intent.club_id;

  elsif v_type = 'payment.failed' then
    if v_intent is not null and v_intent.status not in ('succeeded') then
      update public.payment_intents set status = 'failed', failure = left(coalesce(p->>'reason', 'Plata a fost refuzată.'), 300)
      where id = v_intent.id;
    end if;
    v_club := v_intent.club_id;

  elsif v_type = 'refund.succeeded' then
    select * into v_pay from public.payments where provider = v_provider and provider_ref = p->>'payment_ref' for update;
    if v_pay is null then raise exception 'Returnare pentru o plată necunoscută.'; end if;
    v_refund := least((p->>'amount')::bigint, v_pay.amount - v_pay.refunded_amount);
    update public.payments set refunded_amount = refunded_amount + v_refund where id = v_pay.id;
    -- eliberează alocările de la cele mai noi taxe, cât să nu depășească ce a rămas din plată
    select coalesce(sum(al.amount), 0) - (v_pay.amount - v_pay.refunded_amount - v_refund) into v_free
    from public.allocations al where al.payment_id = v_pay.id;
    for a in select al.id, al.amount from public.allocations al join public.charges c on c.id = al.charge_id
             where al.payment_id = v_pay.id order by c.due_on desc, c.issued_at desc loop
      exit when v_free <= 0;
      if a.amount <= v_free then delete from public.allocations where id = a.id; v_free := v_free - a.amount;
      else update public.allocations set amount = amount - v_free where id = a.id; v_free := 0; end if;
    end loop;
    v_id := v_pay.id;
    v_club := v_pay.club_id;
  else
    raise exception 'Tip de eveniment necunoscut: %', v_type;
  end if;

  update public.provider_events set processed_at = now(), club_id = v_club where id = v_evt;
  return jsonb_build_object('status', 'ok', 'payment_id', v_id);
end $$;

-- Plata automată lunară: părintele o pornește sau o oprește pe metoda salvată.
create or replace function public.set_auto_pay(p_method uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.payment_methods set auto_pay = p_on
  where id = p_method and revoked_at is null and guardian_id = any (private.my_guardian_ids());
  if not found then raise exception 'Metodă de plată necunoscută.' using errcode = '42501'; end if;
end $$;

create or replace function public.revoke_payment_method(p_method uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.payment_methods set revoked_at = now(), auto_pay = false
  where id = p_method and revoked_at is null
    and (guardian_id = any (private.my_guardian_ids()) or (private.is_finance() and club_id = private.my_club()));
  if not found then raise exception 'Metodă de plată necunoscută.' using errcode = '42501'; end if;
end $$;

-- Pentru plata automată (sarcina programată): familiile cu metodă salvată și taxe deschise ajunse la emitere.
create or replace function public.auto_pay_candidates(p_club uuid) returns table (guardian_id uuid, method_ref text, provider text, charge_ids uuid[], amount bigint)
language sql stable security definer set search_path = '' as $$
  select pm.guardian_id, pm.provider_ref, pm.provider, array_agg(cb.id order by cb.due_on), sum(cb.balance)::bigint
  from public.payment_methods pm
  join public.charge_balances cb on cb.guardian_id = pm.guardian_id and cb.status = 'open' and cb.balance > 0
  where pm.club_id = p_club and pm.auto_pay and pm.revoked_at is null
    and cb.kind = 'monthly' and cb.period <= private.club_today(p_club)
    and not exists (select 1 from public.payment_intents pi where pi.guardian_id = pm.guardian_id
                    and pi.status in ('pending', 'created') and pi.charge_ids && array[cb.id] and pi.created_at > now() - interval '1 day')
  group by pm.guardian_id, pm.provider_ref, pm.provider
$$;

create or replace function public.create_auto_pay_intent(p_guardian uuid, p_charge_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_club uuid; v_fs record; v_amount bigint; v_id uuid; v_players uuid[];
begin
  select g.club_id into v_club from public.guardians g where g.id = p_guardian;
  select * into v_fs from public.finance_settings where club_id = v_club;
  select coalesce(sum(cb.balance), 0), array_agg(distinct cb.player_id) into v_amount, v_players
  from public.charge_balances cb where cb.id = any (p_charge_ids) and cb.club_id = v_club and cb.balance > 0 and cb.status = 'open';
  if v_amount <= 0 then return null; end if;
  insert into public.payment_intents (club_id, guardian_id, player_id, provider, amount, charge_ids)
  values (v_club, p_guardian, case when cardinality(v_players) = 1 then v_players[1] end, v_fs.provider, v_amount, p_charge_ids)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'amount', v_amount, 'provider', v_fs.provider, 'currency', v_fs.currency);
end $$;

-- ---------------------------------------------------------------------------
-- Ce vede părintele: datele de transfer și codul de plată al familiei
-- ---------------------------------------------------------------------------
create or replace function public.family_payment_info() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'beneficiary', coalesce(fs.beneficiary, c.name), 'iban', fs.iban, 'bank_name', fs.bank_name,
    'currency', fs.currency, 'online_enabled', fs.online_enabled, 'provider', fs.provider, 'due_day', fs.due_day,
    'refs', coalesce((select jsonb_agg(jsonb_build_object('guardian_id', g.id, 'name', g.full_name, 'ref', g.payment_ref) order by g.created_at)
                      from public.guardians g where g.id = any (private.my_guardian_ids())), '[]'::jsonb))
  from public.finance_settings fs join public.clubs c on c.id = fs.club_id
  where fs.club_id = private.my_club()
$$;

-- ---------------------------------------------------------------------------
-- Drepturi de execuție
-- ---------------------------------------------------------------------------
revoke execute on function
  public.issue_monthly_charges(date, uuid), public.preview_monthly_charges(date), public.send_fee_reminders(),
  public.record_payment(jsonb), public.allocate_payment(uuid, jsonb, uuid, uuid), public.void_payment(uuid, text),
  public.cancel_charge(uuid, text), public.set_charge_discount(uuid, bigint, text), public.save_charge_request(jsonb),
  public.create_payment_intent(uuid[], boolean), public.attach_intent_checkout(uuid, text, text),
  public.apply_provider_event(jsonb), public.set_auto_pay(uuid, boolean), public.revoke_payment_method(uuid),
  public.auto_pay_candidates(uuid), public.create_auto_pay_intent(uuid, uuid[]), public.family_payment_info()
from public, anon;
grant execute on function
  public.issue_monthly_charges(date, uuid), public.preview_monthly_charges(date),
  public.record_payment(jsonb), public.allocate_payment(uuid, jsonb, uuid, uuid), public.void_payment(uuid, text),
  public.cancel_charge(uuid, text), public.set_charge_discount(uuid, bigint, text), public.save_charge_request(jsonb),
  public.create_payment_intent(uuid[], boolean), public.set_auto_pay(uuid, boolean), public.revoke_payment_method(uuid),
  public.family_payment_info()
to authenticated, service_role;
-- doar serverul (webhook, sarcina programată)
grant execute on function
  public.send_fee_reminders(), public.attach_intent_checkout(uuid, text, text), public.apply_provider_event(jsonb),
  public.auto_pay_candidates(uuid), public.create_auto_pay_intent(uuid, uuid[])
to service_role;
revoke execute on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;
