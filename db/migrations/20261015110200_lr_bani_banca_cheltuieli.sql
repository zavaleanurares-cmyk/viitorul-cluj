-- Locker Room · faza 3 · Bani: extrase bancare, referate, cheltuieli, rapoarte, buget, prime.
set local check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Extrase bancare
-- ---------------------------------------------------------------------------
-- Codul de plată din descriere („LR-1042", „LR 1042", „lr1042"), dacă există în club.
create or replace function private.guardian_by_ref(p_club uuid, p_text text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_prefix text; v_m text[]; v_id uuid;
begin
  if p_text is null then return null; end if;
  select ref_prefix into v_prefix from public.finance_settings where club_id = p_club;
  for v_m in select regexp_matches(upper(p_text), '(?:^|[^A-Z0-9])' || coalesce(v_prefix, 'LR') || '[\s\-_./]*([0-9]{4,6})(?![0-9])', 'g') loop
    select g.id into v_id from public.guardians g
    where g.club_id = p_club and g.deleted_at is null and g.payment_ref = coalesce(v_prefix, 'LR') || '-' || v_m[1];
    if v_id is not null then return v_id; end if;
  end loop;
  return null;
end $$;

-- Ce ar face importul, rând cu rând, fără să scrie nimic.
--   p_lines = [{ hash, booked_on, amount, description, counterparty }]
create or replace function public.preview_bank_lines(p_lines jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_club uuid := private.my_club(); r jsonb; v_out jsonb := '[]'::jsonb; v_amount bigint;
  v_gid uuid; v_gname text; v_gref text; v_gbal bigint; v_eid uuid; v_elabel text;
begin
  if not private.is_finance() then raise exception 'Doar biroul importă extrase.' using errcode = '42501'; end if;
  if jsonb_array_length(coalesce(p_lines, '[]')) > 5000 then raise exception 'Extrasul are prea multe rânduri (maximum 5000).'; end if;
  for r in select * from jsonb_array_elements(coalesce(p_lines, '[]')) loop
    v_amount := (r->>'amount')::bigint;
    v_gid := null; v_gname := null; v_gref := null; v_gbal := null; v_eid := null; v_elabel := null;
    if v_amount > 0 then
      v_gid := private.guardian_by_ref(v_club, concat_ws(' ', r->>'description', r->>'counterparty'));
      if v_gid is not null then
        select g.full_name, g.payment_ref,
               (select coalesce(sum(cb.balance), 0) from public.charge_balances cb
                where cb.club_id = v_club and cb.status = 'open' and cb.balance > 0
                  and cb.player_id in (select gp.player_id from public.guardian_players gp where gp.guardian_id = g.id))
          into v_gname, v_gref, v_gbal from public.guardians g where g.id = v_gid;
      end if;
    elsif v_amount < 0 then
      select e.id, concat_ws(' · ', e.description, e.supplier) into v_eid, v_elabel from public.expenses e
      where e.club_id = v_club and e.deleted_at is null and e.amount = -v_amount and e.method = 'bank'
        and e.spent_on between (r->>'booked_on')::date - 7 and (r->>'booked_on')::date + 7
        and not exists (select 1 from public.bank_lines bl where bl.expense_id = e.id)
      order by abs(e.spent_on - (r->>'booked_on')::date) limit 1;
    end if;
    v_out := v_out || jsonb_build_object(
      'hash', r->>'hash',
      'duplicate', exists (select 1 from public.bank_lines bl where bl.club_id = v_club and bl.line_hash = r->>'hash'),
      'guardian_id', v_gid, 'guardian_name', v_gname, 'payment_ref', v_gref, 'open_balance', v_gbal,
      'expense_id', v_eid, 'expense_label', v_elabel);
  end loop;
  return v_out;
end $$;

-- Rezolvă un rând: plată de la o familie, legătură cu o cheltuială sau ignorat (transfer intern, plată de la operator).
create or replace function private.resolve_line(p_line uuid, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_l record; v_action text := coalesce(p->>'action', 'leave'); v_pay uuid;
begin
  select * into v_l from public.bank_lines where id = p_line;
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
      if exists (select 1 from public.payments where id = v_l.payment_id and method = 'bank') then
        delete from public.allocations where payment_id = v_l.payment_id;
        update public.payments set status = 'void', void_reason = 'Rând de extras redeschis' where id = v_l.payment_id;
      end if;
    end if;
    update public.expenses set bank_line_id = null where bank_line_id = p_line;
    update public.bank_lines set status = 'unmatched', payment_id = null, expense_id = null, note = null, matched_by = null, matched_at = null where id = p_line;
  end if;
end $$;

--   p = { file_name, bank?, lines: [{ hash, booked_on, amount, description, counterparty, action?, guardian_id?, expense_id?, note? }] }
create or replace function public.import_bank_statement(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_club uuid := private.my_club(); v_id uuid; r jsonb; v_line uuid; v_new int := 0; v_dup int := 0; v_matched int := 0;
begin
  if not private.is_finance() then raise exception 'Doar biroul importă extrase.' using errcode = '42501'; end if;
  if jsonb_array_length(coalesce(p->'lines', '[]')) = 0 then raise exception 'Extrasul nu are rânduri.'; end if;
  if jsonb_array_length(p->'lines') > 5000 then raise exception 'Extrasul are prea multe rânduri (maximum 5000).'; end if;
  insert into public.bank_statements (club_id, file_name, bank, imported_by)
  values (v_club, left(coalesce(p->>'file_name', 'extras'), 200), nullif(p->>'bank', ''), app_auth.uid())
  returning id into v_id;
  for r in select * from jsonb_array_elements(p->'lines') loop
    if coalesce((r->>'amount')::bigint, 0) = 0 or nullif(r->>'hash', '') is null or nullif(r->>'booked_on', '') is null then continue; end if;
    insert into public.bank_lines (club_id, statement_id, booked_on, amount, description, counterparty, line_hash)
    values (v_club, v_id, (r->>'booked_on')::date, (r->>'amount')::bigint, left(r->>'description', 500), left(r->>'counterparty', 200), r->>'hash')
    on conflict (club_id, line_hash) do nothing
    returning id into v_line;
    if v_line is null then v_dup := v_dup + 1; continue; end if;
    v_new := v_new + 1;
    if coalesce(r->>'action', 'leave') <> 'leave' then
      perform private.resolve_line(v_line, r);
      v_matched := v_matched + 1;
    end if;
  end loop;
  update public.bank_statements s set line_count = v_new,
    period_from = (select min(booked_on) from public.bank_lines where statement_id = v_id),
    period_to = (select max(booked_on) from public.bank_lines where statement_id = v_id)
  where s.id = v_id;
  return jsonb_build_object('statement_id', v_id, 'inserted', v_new, 'duplicates', v_dup, 'matched', v_matched);
end $$;

create or replace function public.resolve_bank_line(p_line uuid, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_l record;
begin
  if not private.is_finance() then raise exception 'Doar biroul lucrează cu extrasele.' using errcode = '42501'; end if;
  select * into v_l from public.bank_lines where id = p_line and club_id = private.my_club();
  if v_l is null then raise exception 'Rând necunoscut.' using errcode = '42501'; end if;
  if coalesce(p->>'action', '') <> 'reopen' and v_l.status <> 'unmatched' then raise exception 'Rândul este deja rezolvat.'; end if;
  perform private.resolve_line(p_line, p);
end $$;

-- ---------------------------------------------------------------------------
-- Referate de necesitate
-- ---------------------------------------------------------------------------
create or replace function private.notify_users(p_club uuid, p_roles public.app_role[], p_kind text, p_title text, p_body text, p_link text, p_key text, p_except uuid default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  select pr.id, p_kind, p_title, p_body, p_link, p_key from public.profiles pr
  where pr.club_id = p_club and pr.is_active and pr.role = any (p_roles) and pr.id is distinct from p_except
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
$$;

--   p = { id?, department_id?, group_id?, justification, needed_by?, spec_path?, submit: bool,
--         items: [{ name, details?, unit?, quantity, unit_price, vat_rate, price_includes_vat }] }
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
    select * into v_req from public.purchase_requests where id = v_id and club_id = v_club;
    if v_req is null then raise exception 'Referat necunoscut.' using errcode = '42501'; end if;
    if v_req.status not in ('draft', 'submitted') then raise exception 'Referatul a fost deja hotărât.'; end if;
    if v_req.requested_by is distinct from app_auth.uid() and not private.is_finance() then
      raise exception 'Doar autorul sau biroul modifică referatul.' using errcode = '42501';
    end if;
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
      submitted_at = case when v_submit then coalesce(submitted_at, now()) end
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

create or replace function public.cancel_purchase_request(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_req record;
begin
  select * into v_req from public.purchase_requests where id = p_id and club_id = private.my_club();
  if v_req is null then raise exception 'Referat necunoscut.' using errcode = '42501'; end if;
  if v_req.requested_by is distinct from app_auth.uid() and not private.is_finance() then raise exception 'Nu poți anula acest referat.' using errcode = '42501'; end if;
  if v_req.status in ('completed', 'cancelled') then raise exception 'Referatul este deja închis.'; end if;
  update public.purchase_requests set status = 'cancelled' where id = p_id;
end $$;

-- Cumpărat: devine cheltuială (cu factura) și referatul se închide.
--   p = { spent_on, supplier, invoice_no?, amount?, method, document_path? }
create or replace function public.complete_purchase_request(p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_req record; v_id uuid;
begin
  if not private.is_finance() then raise exception 'Doar biroul înregistrează cheltuielile.' using errcode = '42501'; end if;
  select * into v_req from public.purchase_requests where id = p_id and club_id = private.my_club() for update;
  if v_req is null then raise exception 'Referat necunoscut.' using errcode = '42501'; end if;
  if v_req.status <> 'approved' then raise exception 'Doar un referat aprobat devine cheltuială.'; end if;
  insert into public.expenses (club_id, department_id, description, supplier, invoice_no, amount, spent_on, method, purchase_request_id, group_id, document_path, created_by)
  values (v_req.club_id, v_req.department_id, 'Referat nr. ' || v_req.number || ' · ' || left(v_req.justification, 200),
          nullif(trim(p->>'supplier'), ''), nullif(trim(p->>'invoice_no'), ''),
          coalesce(nullif(p->>'amount', '')::bigint, v_req.total), coalesce(nullif(p->>'spent_on', '')::date, private.club_today(v_req.club_id)),
          coalesce(nullif(p->>'method', ''), 'bank'), p_id, v_req.group_id, nullif(p->>'document_path', ''), app_auth.uid())
  returning id into v_id;
  update public.purchase_requests set status = 'completed' where id = p_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Rapoarte: un singur registru în spatele fiecărei cifre
-- ---------------------------------------------------------------------------
-- p_month: luna detaliată pe echipe (1–12)
create or replace function public.money_summary(p_year int, p_month int default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); v_today date; v_from date := make_date(p_year, 1, 1); v_to date := make_date(p_year + 1, 1, 1);
  v_months jsonb; v_teams jsonb; v_month date; v_kpi jsonb;
begin
  if not private.can_see_money_summary() then raise exception 'Nu ai acces la cifrele financiare.' using errcode = '42501'; end if;
  v_today := private.club_today(v_club);
  v_month := make_date(p_year, coalesce(p_month, case when extract(year from v_today) = p_year then extract(month from v_today)::int else 12 end), 1);

  -- pe luni: emis (după luna taxei sau scadență), încasat (după data plății), cheltuit, planificat
  select jsonb_agg(jsonb_build_object(
      'month', m,
      'expected', coalesce((select sum(c.amount - c.discount) from public.charges c
                            where c.club_id = v_club and c.status = 'open'
                              and coalesce(c.period, date_trunc('month', c.due_on)::date) = make_date(p_year, m, 1)), 0),
      'collected_for_month', coalesce((select sum(a.amount) from public.allocations a join public.charges c on c.id = a.charge_id
                            where c.club_id = v_club and c.status = 'open'
                              and coalesce(c.period, date_trunc('month', c.due_on)::date) = make_date(p_year, m, 1)), 0),
      'received', coalesce((select sum(p.amount - p.refunded_amount) from public.payments p
                            where p.club_id = v_club and p.status = 'completed'
                              and p.received_on >= make_date(p_year, m, 1) and p.received_on < (make_date(p_year, m, 1) + interval '1 month')::date), 0),
      'spent', coalesce((select sum(e.amount) from public.expenses e
                         where e.club_id = v_club and e.deleted_at is null
                           and e.spent_on >= make_date(p_year, m, 1) and e.spent_on < (make_date(p_year, m, 1) + interval '1 month')::date), 0),
      'planned_income', coalesce((select sum(b.amount) from public.budget_lines b where b.club_id = v_club and b.year = p_year and b.month = m and b.kind = 'income'), 0),
      'planned_expense', coalesce((select sum(b.amount) from public.budget_lines b where b.club_id = v_club and b.year = p_year and b.month = m and b.kind = 'expense'), 0)
    ) order by m)
  into v_months from generate_series(1, 12) m;

  -- pe echipe, pentru luna aleasă (după echipa actuală a jucătorului)
  select coalesce(jsonb_agg(t order by t->>'sort', t->>'name'), '[]'::jsonb) into v_teams from (
    select jsonb_build_object('group_id', g.id, 'name', g.name, 'sort', lpad(g.sort::text, 6, '0'),
      'players', count(distinct c.player_id),
      'payers', count(distinct c.player_id) filter (where cb.state in ('paid', 'waived')),
      'expected', coalesce(sum(cb.net), 0), 'collected', coalesce(sum(cb.paid), 0)) as t
    from public.groups g
    join public.players pl on pl.group_id = g.id
    join public.charges c on c.player_id = pl.id and c.status = 'open'
      and coalesce(c.period, date_trunc('month', c.due_on)::date) = v_month
    join public.charge_balances cb on cb.id = c.id
    where g.club_id = v_club
    group by g.id, g.name, g.sort
  ) x;

  select jsonb_build_object(
    'overdue', coalesce((select sum(cb.balance) from public.charge_balances cb where cb.club_id = v_club and cb.status = 'open' and cb.balance > 0 and cb.due_on < v_today), 0),
    'overdue_families', (select count(distinct coalesce(cb.guardian_id, cb.player_id)) from public.charge_balances cb
                         where cb.club_id = v_club and cb.status = 'open' and cb.balance > 0 and cb.due_on < v_today),
    'unallocated', coalesce((select sum(pb.unallocated) from public.payment_balances pb where pb.club_id = v_club and pb.unallocated > 0), 0),
    'unallocated_count', (select count(*) from public.payment_balances pb where pb.club_id = v_club and pb.unallocated > 0),
    'bank_unmatched', (select count(*) from public.bank_lines bl where bl.club_id = v_club and bl.status = 'unmatched'),
    'requests_pending', (select count(*) from public.purchase_requests r where r.club_id = v_club and r.status = 'submitted'),
    'requests_approved', (select count(*) from public.purchase_requests r where r.club_id = v_club and r.status = 'approved'),
    'adjusted_players', (select count(distinct a.player_id) from public.fee_adjustments a where a.club_id = v_club and a.deleted_at is null
                          and a.from_month <= v_month and (a.to_month is null or a.to_month >= v_month))
  ) into v_kpi;

  return jsonb_build_object('year', p_year, 'month', extract(month from v_month)::int, 'today', v_today,
                            'months', v_months, 'teams', v_teams, 'kpi', v_kpi);
end $$;

-- Buget: planificat vs realizat pe departament (departamentele-copil se adună la părinte) și pe luni.
create or replace function public.budget_report(p_year int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); v_out jsonb;
begin
  if not private.can_see_money_summary() then raise exception 'Nu ai acces la buget.' using errcode = '42501'; end if;
  with recursive tree as (
    select d.id, d.id as root from public.departments d where d.club_id = v_club and d.parent_id is null and d.deleted_at is null
    union all
    select d.id, t.root from public.departments d join tree t on d.parent_id = t.id where d.deleted_at is null
  ),
  roots as (select d.id, d.name, d.sort from public.departments d where d.club_id = v_club and d.parent_id is null and d.deleted_at is null),
  actual as (
    select coalesce(t.root, '00000000-0000-0000-0000-000000000000'::uuid) as root, extract(month from e.spent_on)::int as m, sum(e.amount) as amount
    from public.expenses e left join tree t on t.id = e.department_id
    where e.club_id = v_club and e.deleted_at is null and extract(year from e.spent_on) = p_year
    group by 1, 2
  ),
  planned as (
    select coalesce(t.root, '00000000-0000-0000-0000-000000000000'::uuid) as root, b.month as m, sum(b.amount) as amount
    from public.budget_lines b left join tree t on t.id = b.department_id
    where b.club_id = v_club and b.year = p_year and b.kind = 'expense'
    group by 1, 2
  )
  select jsonb_build_object('departments', coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'name', r.name,
      'planned', (select coalesce(jsonb_agg(coalesce((select pl.amount from planned pl where pl.root = r.id and pl.m = m), 0) order by m), '[]') from generate_series(1, 12) m),
      'actual', (select coalesce(jsonb_agg(coalesce((select a.amount from actual a where a.root = r.id and a.m = m), 0) order by m), '[]') from generate_series(1, 12) m)
    ) order by r.sort, r.name), '[]'::jsonb),
    'unassigned', (select coalesce(jsonb_agg(coalesce((select a.amount from actual a where a.root = '00000000-0000-0000-0000-000000000000'::uuid and a.m = m), 0) order by m), '[]') from generate_series(1, 12) m))
  into v_out from roots r;
  return v_out;
end $$;

-- ---------------------------------------------------------------------------
-- Prime: calculate din meciurile închise, apoi aprobate și plătite
-- ---------------------------------------------------------------------------
create or replace function public.compute_bonuses(p_from date, p_to date) returns int
language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); r record; m record; v_n int := 0; v_result text;
begin
  if not (private.my_role() in ('admin', 'accountant')) then raise exception 'Doar biroul calculează primele.' using errcode = '42501'; end if;
  for r in select * from public.bonus_rules b where b.club_id = v_club and b.is_active and b.deleted_at is null loop
    for m in
      select e.id as event_id, mt.goals_for, mt.goals_against, mt.competition_id
      from public.events e join public.matches mt on mt.event_id = e.id
      where e.club_id = v_club and mt.status = 'finished' and e.deleted_at is null
        and e.starts_at >= p_from and e.starts_at < p_to + 1
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

create or replace function public.decide_bonus_entries(p_ids uuid[], p_status text) returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  if not (private.my_role() in ('admin', 'accountant')) then raise exception 'Doar biroul aprobă primele.' using errcode = '42501'; end if;
  if p_status not in ('approved', 'paid', 'cancelled', 'pending') then raise exception 'Stare necunoscută.'; end if;
  update public.bonus_entries set status = p_status, decided_by = app_auth.uid(), decided_at = now()
  where id = any (p_ids) and club_id = private.my_club();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------------------------------------------------------------------------
-- Drepturi de execuție
-- ---------------------------------------------------------------------------
revoke execute on function
  public.preview_bank_lines(jsonb), public.import_bank_statement(jsonb), public.resolve_bank_line(uuid, jsonb),
  public.save_purchase_request(jsonb), public.decide_purchase_request(uuid, text, text), public.cancel_purchase_request(uuid),
  public.complete_purchase_request(uuid, jsonb), public.money_summary(int, int), public.budget_report(int),
  public.compute_bonuses(date, date), public.decide_bonus_entries(uuid[], text)
from public, anon;
grant execute on function
  public.preview_bank_lines(jsonb), public.import_bank_statement(jsonb), public.resolve_bank_line(uuid, jsonb),
  public.save_purchase_request(jsonb), public.decide_purchase_request(uuid, text, text), public.cancel_purchase_request(uuid),
  public.complete_purchase_request(uuid, jsonb), public.money_summary(int, int), public.budget_report(int),
  public.compute_bonuses(date, date), public.decide_bonus_entries(uuid[], text)
to authenticated, service_role;
revoke execute on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;
