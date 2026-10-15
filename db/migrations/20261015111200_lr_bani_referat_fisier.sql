-- Locker Room · faza 3 · Bani: verificarea specificației la un referat nou (fără rând vechi).
set local check_function_bodies = off;
create or replace function public.save_purchase_request(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_club uuid := private.my_club(); v_id uuid := nullif(p->>'id', '')::uuid; v_req record; v_fs record;
  r jsonb; v_pos int := 0; v_gross bigint; v_net bigint; v_vat bigint; v_tnet bigint := 0; v_tvat bigint := 0;
  v_qty numeric; v_price bigint; v_rate int; v_incl boolean; v_submit boolean := coalesce((p->>'submit')::boolean, true);
  v_status text; v_old_spec text;
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
    v_old_spec := v_req.spec_path;
    if v_req.status not in ('draft', 'submitted') then raise exception 'Referatul a fost deja hotărât.'; end if;
    if v_req.requested_by is distinct from app_auth.uid() and not private.is_finance() then
      raise exception 'Doar autorul sau biroul modifică referatul.' using errcode = '42501';
    end if;
  end if;
  -- specificația: doar un fișier încărcat de autor în dosarul lui (sau cel deja atașat)
  if nullif(p->>'spec_path', '') is not null
     and p->>'spec_path' is distinct from v_old_spec
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
