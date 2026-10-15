-- Locker Room · faza 3 · Bani: corecturi după revizia independentă.
--  - plăți online: plățile de test nu mai sunt pornite implicit; evenimentul trebuie să fie al operatorului intenției,
--    intenția se blochează, o a doua încasare nu se mai împarte singură; plata automată refuzată de două ori se oprește
--  - extras: rândul se blochează și se verifică din nou (un rând = o singură plată); doar plăți prin bancă din extras
--  - referate: specificația doar din dosarul autorului; cine a modificat referatul nu îl aprobă; rândul se blochează
--  - cine aprobă referatele: doar administratorul schimbă lista
--  - emitere: modul de serviciu după rol, nu după lipsa utilizatorului; frații scutiți nu contează; club cu club
--  - alocări serializate; chitanțe numerotate pe serie; data plății nu poate fi în viitor; prime în fusul clubului
--  - operațiuni atomice noi: buget, ștergerea unei cereri, schimbarea taxei, cheltuială din extras
set local check_function_bodies = off;

alter table public.finance_settings alter column online_enabled set default false;
update public.finance_settings fs set online_enabled = false
where not exists (select 1 from public.payment_intents pi where pi.club_id = fs.club_id);
alter table public.purchase_requests add column last_edited_by uuid references public.profiles(id) on delete set null;
revoke update (approver_roles) on public.finance_settings from authenticated;

-- jucătorul adult își vede propriile intenții de plată
drop policy payment_intents_select on public.payment_intents;
create policy payment_intents_select on public.payment_intents for select to authenticated
  using (club_id = (select private.my_club()) and (
    (select private.is_finance()) or guardian_id = any ((select private.my_guardian_ids())::uuid[])
    or created_by = (select app_auth.uid())));

create or replace function private.allocations_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_pay record; v_charge record; v_sum bigint;
begin
  if tg_op = 'DELETE' then return null; end if;
  -- serializăm verificările pe aceeași plată / taxă (altfel două tranzacții paralele ar trece fiecare de verificare)
  perform 1 from public.payments where id = new.payment_id for update;
  perform 1 from public.charges where id = new.charge_id for update;
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
          private.next_counter(v_p.club_id, 'receipt:' || coalesce(v_fs.receipt_prefix, 'CH') || v_year::text, 1)::int,
          v_p.received_on, v_payer, v_p.amount, coalesce(v_desc, 'Avans în contul taxelor'), app_auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.issue_monthly_charges(p_period date, p_club uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_service boolean := coalesce(app_auth.role(), '') = 'service_role';
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
        and (o.enrolled_on is null or o.enrolled_on < (v_period + interval '1 month')::date)
        -- fratele scutit sau în pauză luna aceasta nu plătește, deci nu „ocupă" locul de prim copil
        and not exists (select 1 from public.fee_adjustments wa where wa.player_id = o.id and wa.deleted_at is null
                        and wa.kind = 'waiver' and wa.from_month <= v_period and (wa.to_month is null or wa.to_month >= v_period))
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
  if v_line is not null then
    if v_method <> 'bank' then raise exception 'Un rând din extras devine doar plată prin bancă.'; end if;
    perform 1 from public.bank_lines where id = v_line for update;
    if not exists (select 1 from public.bank_lines where id = v_line and club_id = v_club and status = 'unmatched' and amount = v_amount) then
      raise exception 'Rândul din extras nu se potrivește sau a fost deja rezolvat.';
    end if;
  end if;
  if nullif(p->>'received_on', '')::date > private.club_today(v_club) then raise exception 'Data plății nu poate fi în viitor.'; end if;
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

create or replace function public.auto_pay_candidates(p_club uuid) returns table (guardian_id uuid, method_ref text, provider text, charge_ids uuid[], amount bigint)
language sql stable security definer set search_path = '' as $$
  select pm.guardian_id, pm.provider_ref, pm.provider, array_agg(cb.id order by cb.due_on), sum(cb.balance)::bigint
  from public.payment_methods pm
  join public.charge_balances cb on cb.guardian_id = pm.guardian_id and cb.status = 'open' and cb.balance > 0
  where pm.club_id = p_club and pm.auto_pay and pm.revoked_at is null
    and cb.kind = 'monthly' and cb.period <= private.club_today(p_club)
    -- nicio încercare în curs (oricât de veche) și cel mult două refuzuri pe aceeași taxă
    and not exists (select 1 from public.payment_intents pi where pi.guardian_id = pm.guardian_id
                    and pi.status in ('pending', 'created') and pi.charge_ids && array[cb.id])
    and (select count(*) from public.payment_intents pi where pi.guardian_id = pm.guardian_id
         and pi.status = 'failed' and pi.charge_ids && array[cb.id]) < 2
  group by pm.guardian_id, pm.provider_ref, pm.provider
$$;

create or replace function public.apply_provider_event(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_provider text := p->>'provider'; v_type text := p->>'type'; v_evt uuid; v_done timestamptz;
  v_intent record; v_pay record; v_id uuid; v_left bigint; v_refund bigint; v_free bigint; a record; v_today date; v_club uuid; v_note text;
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

  -- intenția trebuie să fie a acestui operator; o blocăm cât aplicăm evenimentul
  select * into v_intent from public.payment_intents
  where provider = v_provider and ((id = nullif(p->>'intent_id', '')::uuid) or (provider_ref = nullif(p->>'intent_ref', '')))
  limit 1 for update;

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
      if v_intent.status = 'succeeded' then
        -- a doua încasare pe aceeași intenție: banii au intrat, dar nu îi împărțim singuri (ajung la „De asociat")
        v_note := 'Intenție deja plătită; plata a doua rămâne de asociat (posibil de returnat).';
      else
        v_left := private.auto_allocate(v_id, v_intent.charge_ids);
      end if;
      if (p->>'amount')::bigint <> v_intent.amount then
        v_note := concat_ws(' ', v_note, 'Suma diferă de intenție (' || v_intent.amount || ' bani).');
      end if;
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
    update public.payment_intents set status = 'succeeded', payment_id = coalesce(payment_id, v_id) where id = v_intent.id;
    v_club := v_intent.club_id;

  elsif v_type = 'payment.failed' then
    if v_intent is not null and v_intent.status not in ('succeeded') then
      update public.payment_intents set status = 'failed', failure = left(coalesce(p->>'reason', 'Plata a fost refuzată.'), 300)
      where id = v_intent.id;
      -- plata automată refuzată de două ori: o oprim și îi spunem părintelui
      if v_intent.created_by is null and v_intent.guardian_id is not null
         and (select count(*) from public.payment_intents x where x.guardian_id = v_intent.guardian_id and x.created_by is null
              and x.status = 'failed' and x.created_at > now() - interval '40 days') >= 2 then
        update public.payment_methods set auto_pay = false where guardian_id = v_intent.guardian_id and revoked_at is null and auto_pay;
        if found then
          perform private.notify_guardian(v_intent.guardian_id, 'fee_reminder', 'Plata automată a fost oprită',
            'Cardul salvat a fost refuzat de două ori. Plătește din aplicație sau schimbă cardul.', '/plati', 'autopay-off:' || v_intent.id::text);
        end if;
      end if;
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

  update public.provider_events set processed_at = now(), club_id = v_club, error = v_note where id = v_evt;
  return jsonb_build_object('status', 'ok', 'payment_id', v_id);
end $$;

create or replace function private.resolve_line(p_line uuid, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_l record; v_action text := coalesce(p->>'action', 'leave'); v_pay uuid;
begin
  select * into v_l from public.bank_lines where id = p_line for update;
  if v_action not in ('reopen', 'leave') and v_l.status <> 'unmatched' then raise exception 'Rândul a fost deja rezolvat.'; end if;
  if v_action = 'match_guardian' then
    if v_l.amount <= 0 then raise exception 'Doar încasările se asociază cu o familie.'; end if;
    if private.guardian_club(nullif(p->>'guardian_id', '')::uuid) is distinct from v_l.club_id then
      raise exception 'Părinte necunoscut.' using errcode = '42501';
    end if;
    insert into public.payments (club_id, guardian_id, amount, method, received_on, payer_name, reference, recorded_by)
    values (v_l.club_id, (p->>'guardian_id')::uuid, v_l.amount, 'bank', v_l.booked_on, v_l.counterparty, v_l.description, app_auth.uid())
    returning id into v_pay;
    perform private.auto_allocate(v_pay);
    update public.bank_lines set status = 'matched', payment_id = v_pay, matched_by = app_auth.uid(), matched_at = now() where id = p_line;
  elsif v_action = 'unassigned_payment' then
    -- încasare de la cineva necunoscut: intră în „Plăți de asociat"
    if v_l.amount <= 0 then raise exception 'Doar încasările devin plăți.'; end if;
    insert into public.payments (club_id, amount, method, received_on, payer_name, reference, recorded_by)
    values (v_l.club_id, v_l.amount, 'bank', v_l.booked_on, v_l.counterparty, v_l.description, app_auth.uid())
    returning id into v_pay;
    update public.bank_lines set status = 'matched', payment_id = v_pay, matched_by = app_auth.uid(), matched_at = now() where id = p_line;
  elsif v_action = 'match_expense' then
    if v_l.amount >= 0 then raise exception 'Doar plățile ieșite se leagă de cheltuieli.'; end if;
    if not exists (select 1 from public.expenses e where e.id = (p->>'expense_id')::uuid and e.club_id = v_l.club_id and e.deleted_at is null) then
      raise exception 'Cheltuială necunoscută.' using errcode = '42501';
    end if;
    update public.bank_lines set status = 'matched', expense_id = (p->>'expense_id')::uuid, matched_by = app_auth.uid(), matched_at = now() where id = p_line;
    update public.expenses set bank_line_id = p_line where id = (p->>'expense_id')::uuid;
  elsif v_action = 'ignore' then
    update public.bank_lines set status = 'ignored', note = nullif(trim(p->>'note'), ''), matched_by = app_auth.uid(), matched_at = now() where id = p_line;
  elsif v_action = 'reopen' then
    if v_l.payment_id is not null then
      if exists (select 1 from public.payments where id = v_l.payment_id) then
        delete from public.allocations where payment_id = v_l.payment_id;
        update public.payments set status = 'void', void_reason = 'Rând de extras redeschis' where id = v_l.payment_id;
      end if;
    end if;
    update public.expenses set bank_line_id = null where bank_line_id = p_line;
    update public.bank_lines set status = 'unmatched', payment_id = null, expense_id = null, note = null, matched_by = null, matched_at = null where id = p_line;
  end if;
end $$;

create or replace function public.save_purchase_request(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_club uuid := private.my_club(); v_id uuid := nullif(p->>'id', '')::uuid; v_req record; v_fs record;
  r jsonb; v_pos int := 0; v_gross bigint; v_net bigint; v_vat bigint; v_tnet bigint := 0; v_tvat bigint := 0;
  v_qty numeric; v_price bigint; v_rate int; v_incl boolean; v_submit boolean := coalesce((p->>'submit')::boolean, true);
  v_status text;
begin
  if not private.is_club_staff() or private.my_role() = 'owner' then raise exception 'Doar staff-ul clubului face referate.' using errcode = '42501'; end if;
  select * into v_fs from public.finance_settings where club_id = v_club;
  if nullif(trim(coalesce(p->>'justification', '')), '') is null then raise exception 'Scrie de ce e nevoie.'; end if;
  if jsonb_array_length(coalesce(p->'items', '[]')) = 0 then raise exception 'Adaugă cel puțin un articol.'; end if;
  if jsonb_array_length(p->'items') > 100 then raise exception 'Prea multe articole (maximum 100).'; end if;
  if nullif(p->>'department_id', '') is not null and not exists (select 1 from public.departments d where d.id = (p->>'department_id')::uuid and d.club_id = v_club) then
    raise exception 'Departament necunoscut.' using errcode = '42501';
  end if;
  if nullif(p->>'group_id', '') is not null and private.group_club((p->>'group_id')::uuid) is distinct from v_club then
    raise exception 'Echipă necunoscută.' using errcode = '42501';
  end if;
  if v_id is not null then
    select * into v_req from public.purchase_requests where id = v_id and club_id = v_club for update;
    if v_req is null then raise exception 'Referat necunoscut.' using errcode = '42501'; end if;
    if v_req.status not in ('draft', 'submitted') then raise exception 'Referatul a fost deja hotărât.'; end if;
    if v_req.requested_by is distinct from app_auth.uid() and not private.is_finance() then
      raise exception 'Doar autorul sau biroul modifică referatul.' using errcode = '42501';
    end if;
  end if;
  -- specificația: doar un fișier încărcat de autor în dosarul lui (sau cel deja atașat)
  if nullif(p->>'spec_path', '') is not null
     and p->>'spec_path' is distinct from v_req.spec_path
     and left(p->>'spec_path', 74) <> v_club::text || '/' || app_auth.uid()::text || '/' then
    raise exception 'Fișier invalid.' using errcode = '42501';
  end if;
  v_status := case when v_submit then 'submitted' else 'draft' end;
  if v_id is null then
    insert into public.purchase_requests (club_id, number, department_id, group_id, justification, needed_by, spec_path, status, requested_by, submitted_at)
    values (v_club, private.next_counter(v_club, 'purchase_request', 1)::int, nullif(p->>'department_id', '')::uuid,
            nullif(p->>'group_id', '')::uuid, trim(p->>'justification'), nullif(p->>'needed_by', '')::date,
            nullif(p->>'spec_path', ''), v_status, app_auth.uid(), case when v_submit then now() end)
    returning * into v_req;
    v_id := v_req.id;
  else
    update public.purchase_requests set department_id = nullif(p->>'department_id', '')::uuid, group_id = nullif(p->>'group_id', '')::uuid,
      justification = trim(p->>'justification'), needed_by = nullif(p->>'needed_by', '')::date,
      spec_path = coalesce(nullif(p->>'spec_path', ''), spec_path), status = v_status,
      submitted_at = case when v_submit then coalesce(submitted_at, now()) end, last_edited_by = app_auth.uid()
    where id = v_id returning * into v_req;
    delete from public.purchase_request_items where request_id = v_id;
  end if;
  for r in select * from jsonb_array_elements(p->'items') loop
    v_pos := v_pos + 1;
    v_qty := (r->>'quantity')::numeric; v_price := (r->>'unit_price')::bigint; v_rate := coalesce((r->>'vat_rate')::int, 0);
    v_incl := coalesce((r->>'price_includes_vat')::boolean, true);
    if nullif(trim(coalesce(r->>'name', '')), '') is null then raise exception 'Articolul % nu are nume.', v_pos; end if;
    if v_qty is null or v_qty <= 0 then raise exception 'Cantitatea la articolul % trebuie să fie mai mare decât zero.', v_pos; end if;
    if v_price is null or v_price < 0 then raise exception 'Prețul la articolul % lipsește.', v_pos; end if;
    if not (v_rate::smallint = any (v_fs.vat_rates)) then raise exception 'Cota de TVA % nu este în lista clubului.', v_rate; end if;
    if v_incl then
      v_gross := round(v_qty * v_price);
      v_net := round(v_gross * 100.0 / (100 + v_rate));
      v_vat := v_gross - v_net;
    else
      v_net := round(v_qty * v_price);
      v_vat := round(v_net * v_rate / 100.0);
    end if;
    insert into public.purchase_request_items (request_id, position, name, details, unit, quantity, unit_price, vat_rate, price_includes_vat, line_net, line_vat)
    values (v_id, v_pos, trim(r->>'name'), nullif(trim(r->>'details'), ''), coalesce(nullif(trim(r->>'unit'), ''), 'buc'),
            v_qty, v_price, v_rate, v_incl, v_net, v_vat);
    v_tnet := v_tnet + v_net; v_tvat := v_tvat + v_vat;
  end loop;
  update public.purchase_requests set total_net = v_tnet, total_vat = v_tvat, total = v_tnet + v_tvat where id = v_id;
  if v_submit then
    perform private.notify_users(v_club, v_fs.approver_roles, 'purchase_request', 'Referat nr. ' || v_req.number || ' de aprobat',
      private.lei(v_tnet + v_tvat) || ' · ' || left(trim(p->>'justification'), 80), '/bani/referate/' || v_id::text,
      'pr:' || v_id::text || ':submitted', app_auth.uid());
  end if;
  return jsonb_build_object('id', v_id, 'number', v_req.number, 'total', v_tnet + v_tvat);
end $$;

create or replace function public.decide_purchase_request(p_id uuid, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_req record;
begin
  if not private.can_approve_purchases() then raise exception 'Nu poți aproba referate.' using errcode = '42501'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'Decizie necunoscută.'; end if;
  select * into v_req from public.purchase_requests where id = p_id and club_id = private.my_club() for update;
  if v_req is null then raise exception 'Referat necunoscut.' using errcode = '42501'; end if;
  if v_req.status <> 'submitted' then raise exception 'Referatul nu așteaptă o decizie.'; end if;
  if v_req.requested_by = app_auth.uid() then raise exception 'Nu îți poți aproba propriul referat.' using errcode = '42501'; end if;
  if v_req.last_edited_by = app_auth.uid() then raise exception 'Ai modificat referatul; îl aprobă altcineva.' using errcode = '42501'; end if;
  if p_decision = 'rejected' and nullif(trim(coalesce(p_note, '')), '') is null then raise exception 'Scrie de ce respingi referatul.'; end if;
  update public.purchase_requests set status = p_decision, decided_by = app_auth.uid(), decided_at = now(), decision_note = nullif(trim(p_note), '')
  where id = p_id;
  if v_req.requested_by is not null then
    insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
    values (v_req.requested_by, 'purchase_request',
            'Referatul nr. ' || v_req.number || case when p_decision = 'approved' then ' a fost aprobat' else ' a fost respins' end,
            nullif(trim(p_note), ''), '/bani/referate/' || p_id::text, 'pr:' || p_id::text || ':' || p_decision)
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;
  if p_decision = 'approved' then
    perform private.notify_users(v_req.club_id, array['accountant']::public.app_role[], 'purchase_request',
      'Referatul nr. ' || v_req.number || ' e aprobat', 'Se poate cumpăra · ' || private.lei(v_req.total),
      '/bani/referate/' || p_id::text, 'pr:' || p_id::text || ':approved-finance', app_auth.uid());
  end if;
end $$;

create or replace function public.complete_purchase_request(p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_req record; v_id uuid;
begin
  if not private.is_finance() then raise exception 'Doar biroul înregistrează cheltuielile.' using errcode = '42501'; end if;
  select * into v_req from public.purchase_requests where id = p_id and club_id = private.my_club() for update;
  if v_req is null then raise exception 'Referat necunoscut.' using errcode = '42501'; end if;
  if v_req.status <> 'approved' then raise exception 'Doar un referat aprobat devine cheltuială.'; end if;
  if nullif(p->>'document_path', '') is not null and left(p->>'document_path', 37) <> v_req.club_id::text || '/' then
    raise exception 'Fișier invalid.' using errcode = '42501';
  end if;
  insert into public.expenses (club_id, department_id, description, supplier, invoice_no, amount, spent_on, method, purchase_request_id, group_id, document_path, created_by)
  values (v_req.club_id, v_req.department_id, 'Referat nr. ' || v_req.number || ' · ' || left(v_req.justification, 200),
          nullif(trim(p->>'supplier'), ''), nullif(trim(p->>'invoice_no'), ''),
          coalesce(nullif(p->>'amount', '')::bigint, v_req.total), coalesce(nullif(p->>'spent_on', '')::date, private.club_today(v_req.club_id)),
          coalesce(nullif(p->>'method', ''), 'bank'), p_id, v_req.group_id, nullif(p->>'document_path', ''), app_auth.uid())
  returning id into v_id;
  update public.purchase_requests set status = 'completed' where id = p_id;
  return v_id;
end $$;

create or replace function public.compute_bonuses(p_from date, p_to date) returns int
language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); r record; m record; v_n int := 0; v_result text;
  v_tz text := coalesce((select c.settings->>'timezone' from public.clubs c where c.id = private.my_club()), 'Europe/Bucharest');
begin
  if not (private.my_role() in ('admin', 'accountant')) then raise exception 'Doar biroul calculează primele.' using errcode = '42501'; end if;
  for r in select * from public.bonus_rules b where b.club_id = v_club and b.is_active and b.deleted_at is null loop
    for m in
      select e.id as event_id, mt.goals_for, mt.goals_against, mt.competition_id
      from public.events e join public.matches mt on mt.event_id = e.id
      where e.club_id = v_club and mt.status = 'finished' and e.deleted_at is null
        and e.starts_at >= (p_from::timestamp at time zone v_tz) and e.starts_at < ((p_to + 1)::timestamp at time zone v_tz)
        and (r.competition_id is null or mt.competition_id = r.competition_id)
        and (r.group_id is null or r.group_id = any (private.event_group_ids(e.id)))
    loop
      v_result := case when m.goals_for > m.goals_against then 'win' when m.goals_for = m.goals_against then 'draw' else 'loss' end;
      if r.target = 'staff' then
        if (r.trigger = 'win' and v_result = 'win') or (r.trigger = 'draw' and v_result = 'draw') or (r.trigger = 'clean_sheet' and m.goals_against = 0) then
          insert into public.bonus_entries (club_id, rule_id, event_id, profile_id, quantity, amount)
          select v_club, r.id, m.event_id, sg.user_id, 1, r.amount
          from public.staff_groups sg join public.profiles pr on pr.id = sg.user_id and pr.club_id = v_club and pr.is_active
          where sg.group_id = any (private.event_group_ids(m.event_id))
          on conflict do nothing;
          get diagnostics v_n = row_count;
        end if;
      else
        insert into public.bonus_entries (club_id, rule_id, event_id, player_id, quantity, amount)
        select v_club, r.id, m.event_id, x.player_id, x.q, x.q * r.amount from (
          select ms.player_id,
                 case r.trigger
                   when 'goal' then (select count(*) from public.match_events me where me.event_id = m.event_id and me.kind = 'goal' and me.player_id = ms.player_id)
                   when 'starter' then case when ms.role = 'starter' then 1 else 0 end
                   when 'appearance' then case when coalesce(ms.minutes, 0) > 0 then 1 else 0 end
                   when 'win' then case when v_result = 'win' and coalesce(ms.minutes, 0) > 0 then 1 else 0 end
                   when 'draw' then case when v_result = 'draw' and coalesce(ms.minutes, 0) > 0 then 1 else 0 end
                   when 'clean_sheet' then case when m.goals_against = 0 and coalesce(ms.minutes, 0) > 0 then 1 else 0 end
                 end::int as q
          from public.match_squad ms where ms.event_id = m.event_id
        ) x where x.q > 0
        on conflict (rule_id, event_id, coalesce(player_id, profile_id)) do update
          set quantity = excluded.quantity, amount = excluded.amount
          where public.bonus_entries.status = 'pending';
      end if;
    end loop;
  end loop;
  select count(*) into v_n from public.bonus_entries where club_id = v_club and status = 'pending';
  return v_n;
end $$;

create or replace function public.auto_issue_due() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v record; v_today date; v_period date; v_res jsonb; v_out jsonb := '[]'::jsonb;
begin
  for v in select fs.club_id, fs.issue_day, fs.last_auto_issue from public.finance_settings fs where fs.auto_issue loop
    v_today := private.club_today(v.club_id);
    v_period := date_trunc('month', v_today)::date;
    if extract(day from v_today) < v.issue_day then continue; end if;
    if v.last_auto_issue is not null and v.last_auto_issue >= v_period then continue; end if;
    -- fiecare club separat: o eroare la unul nu oprește emiterea la celelalte
    begin
      v_res := public.issue_monthly_charges(v_period, v.club_id);
      update public.finance_settings set last_auto_issue = v_period where club_id = v.club_id;
      v_out := v_out || (jsonb_build_object('club_id', v.club_id, 'period', v_period) || v_res);
    exception when others then
      v_out := v_out || jsonb_build_object('club_id', v.club_id, 'period', v_period, 'error', sqlerrm);
    end;
  end loop;
  return v_out;
end $$;

-- ---------------------------------------------------------------------------
-- Operațiuni atomice (înainte: mai multe cereri separate din aplicație)
-- ---------------------------------------------------------------------------
create or replace function public.set_approver_roles(p_roles public.app_role[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if private.my_role() <> 'admin' then raise exception 'Doar administratorul stabilește cine aprobă referatele.' using errcode = '42501'; end if;
  if coalesce(cardinality(p_roles), 0) = 0 then raise exception 'Alege cel puțin un rol care aprobă referatele.'; end if;
  if exists (select 1 from unnest(p_roles) r where r not in ('admin', 'owner', 'sporting_director', 'accountant', 'secretary')) then
    raise exception 'Rol nepotrivit pentru aprobare.';
  end if;
  update public.finance_settings set approver_roles = p_roles where club_id = private.my_club();
end $$;

create or replace function public.save_budget_lines(p_year int, p_kind text, p_department uuid, p_amounts bigint[]) returns void
language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); i int;
begin
  if private.my_role() not in ('admin', 'accountant') then raise exception 'Doar administratorul sau contabilul planifică bugetul.' using errcode = '42501'; end if;
  if p_kind not in ('income', 'expense') then raise exception 'Tip necunoscut.'; end if;
  if p_kind = 'income' and p_department is not null then raise exception 'Încasările nu au departament.'; end if;
  if p_department is not null and private.department_club(p_department) is distinct from v_club then raise exception 'Departament necunoscut.' using errcode = '42501'; end if;
  if cardinality(p_amounts) <> 12 or exists (select 1 from unnest(p_amounts) a where a < 0 or a > 1000000000) then raise exception 'Sume invalide.'; end if;
  delete from public.budget_lines b where b.club_id = v_club and b.year = p_year and b.kind = p_kind and b.department_id is not distinct from p_department;
  for i in 1..12 loop
    if p_amounts[i] > 0 then
      insert into public.budget_lines (club_id, year, month, kind, department_id, amount) values (v_club, p_year, i, p_kind, p_department, p_amounts[i]);
    end if;
  end loop;
end $$;

create or replace function public.delete_charge_request(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_finance() then raise exception 'Doar biroul șterge cereri.' using errcode = '42501'; end if;
  if not exists (select 1 from public.charge_requests where id = p_id and club_id = private.my_club() and deleted_at is null) then
    raise exception 'Cerere necunoscută.' using errcode = '42501';
  end if;
  if exists (select 1 from public.allocations a join public.charges c on c.id = a.charge_id where c.request_id = p_id) then
    raise exception 'Cererea are plăți. Anulează întâi plățile sau taxele plătite.';
  end if;
  update public.charges set status = 'cancelled', cancel_reason = 'Cerere ștearsă' where request_id = p_id and status = 'open';
  update public.charge_requests set deleted_at = now() where id = p_id;
end $$;

-- Taxa unei echipe sau a unui jucător de la o lună: planurile vechi se închid în luna dinainte, cel nou se deschide.
create or replace function public.set_fee_plan(p_group uuid, p_player uuid, p_amount bigint, p_from date, p_reason text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); v_id uuid; r record;
begin
  if not private.is_finance() then raise exception 'Doar biroul stabilește taxele.' using errcode = '42501'; end if;
  if (p_group is null) = (p_player is null) then raise exception 'Alege echipa sau jucătorul.'; end if;
  if p_group is not null and private.group_club(p_group) is distinct from v_club then raise exception 'Echipă necunoscută.' using errcode = '42501'; end if;
  if p_player is not null and not exists (select 1 from public.players where id = p_player and club_id = v_club) then raise exception 'Jucător necunoscut.' using errcode = '42501'; end if;
  if p_amount < 0 or p_amount > 100000000 then raise exception 'Sumă invalidă.'; end if;
  if extract(day from p_from) <> 1 then raise exception 'Alege luna.'; end if;
  for r in select id, valid_from, valid_to from public.fee_plans
           where deleted_at is null and club_id = v_club and group_id is not distinct from p_group and player_id is not distinct from p_player
           for update loop
    if r.valid_to is not null and r.valid_to < p_from then continue; end if;
    if r.valid_from >= p_from then update public.fee_plans set deleted_at = now() where id = r.id;
    else update public.fee_plans set valid_to = (p_from - interval '1 month')::date where id = r.id; end if;
  end loop;
  insert into public.fee_plans (club_id, group_id, player_id, amount, valid_from, reason, created_by)
  values (v_club, p_group, p_player, p_amount, p_from, nullif(trim(p_reason), ''), app_auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.expense_from_bank_line(p_line uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_l record; v_id uuid;
begin
  if not private.is_finance() then raise exception 'Doar biroul lucrează cu extrasele.' using errcode = '42501'; end if;
  select * into v_l from public.bank_lines where id = p_line and club_id = private.my_club() for update;
  if v_l is null or v_l.status <> 'unmatched' or v_l.amount >= 0 then raise exception 'Rândul nu mai poate deveni cheltuială.'; end if;
  if nullif(trim(coalesce(p->>'description', '')), '') is null then raise exception 'Scrie descrierea.'; end if;
  if nullif(p->>'department_id', '') is not null and private.department_club((p->>'department_id')::uuid) is distinct from v_l.club_id then
    raise exception 'Departament necunoscut.' using errcode = '42501';
  end if;
  insert into public.expenses (club_id, department_id, description, supplier, invoice_no, amount, spent_on, method, bank_line_id, created_by)
  values (v_l.club_id, nullif(p->>'department_id', '')::uuid, left(trim(p->>'description'), 300),
          coalesce(nullif(trim(p->>'supplier'), ''), v_l.counterparty), nullif(trim(p->>'invoice_no'), ''), -v_l.amount, v_l.booked_on, 'bank', p_line, app_auth.uid())
  returning id into v_id;
  update public.bank_lines set status = 'matched', expense_id = v_id, matched_by = app_auth.uid(), matched_at = now() where id = p_line;
  return v_id;
end $$;

revoke execute on function public.set_approver_roles(public.app_role[]), public.save_budget_lines(int, text, uuid, bigint[]),
  public.delete_charge_request(uuid), public.set_fee_plan(uuid, uuid, bigint, date, text), public.expense_from_bank_line(uuid, jsonb) from public, anon;
grant execute on function public.set_approver_roles(public.app_role[]), public.save_budget_lines(int, text, uuid, bigint[]),
  public.delete_charge_request(uuid), public.set_fee_plan(uuid, uuid, bigint, date, text), public.expense_from_bank_line(uuid, jsonb) to authenticated, service_role;
revoke execute on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;
