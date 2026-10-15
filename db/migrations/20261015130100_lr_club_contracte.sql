-- Locker Room faza 4 · Club › Contracte: modele cu versiuni, trimitere către părinte (sau jucătorul adult),
-- semnătură electronică simplă în aplicație (nume scris + semnătură desenată), urmă de audit, mementouri.

create table public.contract_templates (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  name       text not null check (length(trim(name)) between 2 and 120),
  kind       text not null default 'other' check (kind in ('enrolment', 'photo_consent', 'medical_consent', 'transport', 'sponsorship', 'other')),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.contract_template_versions (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.contract_templates(id) on delete cascade,
  version     int not null,
  body        text not null check (length(trim(body)) between 20 and 50000),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (template_id, version)
);

create table public.contracts (
  id                  uuid primary key default gen_random_uuid(),
  club_id             uuid not null references public.clubs(id) on delete cascade,
  template_version_id uuid not null references public.contract_template_versions(id) on delete restrict,
  title               text not null,
  player_id           uuid references public.players(id) on delete set null,
  signer_user_id      uuid references public.profiles(id) on delete set null,
  signer_name         text not null,
  body                text not null,                  -- textul exact trimis (instantaneu)
  status              text not null default 'sent' check (status in ('sent', 'signed', 'declined', 'voided')),
  due_on              date,
  sent_at             timestamptz not null default now(),
  sent_by             uuid references public.profiles(id) on delete set null,
  signed_at           timestamptz,
  signed_name         text,
  signature_path      text,                           -- depozitul „contracts": <club>/<contract>/semnatura-<uuid>.png
  signed_ip           text,
  signed_user_agent   text,
  document_hash       text,                           -- sha256(text + nume + moment + semnătură), hex
  decline_reason      text,
  void_reason         text,
  reminders_sent      int not null default 0,
  last_reminded_at    timestamptz,
  check (status <> 'signed' or (signed_at is not null and signed_name is not null and document_hash is not null))
);
create index contracts_club_idx on public.contracts (club_id, status, sent_at desc);
create index contracts_signer_idx on public.contracts (signer_user_id, status);
create index contracts_player_idx on public.contracts (player_id);

create table public.contract_events (
  id          bigint generated always as identity primary key,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  at          timestamptz not null default now(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null check (action in ('sent', 'viewed', 'reminded', 'signed', 'declined', 'voided')),
  ip          text,
  details     text
);
create index contract_events_contract_idx on public.contract_events (contract_id, at);

create or replace function private.can_manage_contracts() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.my_role()) in ('admin', 'secretary'), false)
$$;
grant execute on function private.can_manage_contracts() to authenticated;

alter table public.contract_templates enable row level security;
alter table public.contract_template_versions enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_events enable row level security;
create policy contract_templates_select on public.contract_templates for select to authenticated
  using (club_id = (select private.my_club()) and (select private.can_manage_contracts()));
create policy contract_template_versions_select on public.contract_template_versions for select to authenticated
  using ((select private.can_manage_contracts()) and exists (select 1 from public.contract_templates t where t.id = template_id and t.club_id = (select private.my_club())));
create policy contracts_select on public.contracts for select to authenticated
  using (club_id = (select private.my_club()) and ((select private.can_manage_contracts()) or signer_user_id = (select app_auth.uid())));
create policy contract_events_select on public.contract_events for select to authenticated
  using (exists (select 1 from public.contracts c where c.id = contract_id and c.club_id = (select private.my_club())
                   and ((select private.can_manage_contracts()) or c.signer_user_id = (select app_auth.uid()))));
grant select on public.contract_templates, public.contract_template_versions, public.contracts, public.contract_events to authenticated;

do $$
declare t text;
begin
  foreach t in array array['contract_templates', 'contracts'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit()', t || '_audit', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Modele (fiecare modificare = o versiune nouă; contractele trimise rămân pe versiunea lor)
-- ---------------------------------------------------------------------------
create or replace function public.save_contract_template(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := nullif(p->>'id', '')::uuid; v_ver int; v_last text;
begin
  if not private.can_manage_contracts() then raise exception 'Doar biroul gestionează contractele.' using errcode = '42501'; end if;
  if v_id is null then
    insert into public.contract_templates (club_id, name, kind) values (private.my_club(), trim(p->>'name'), coalesce(p->>'kind', 'other')) returning id into v_id;
  else
    update public.contract_templates set name = trim(p->>'name'), kind = coalesce(p->>'kind', kind), is_active = coalesce((p->>'is_active')::boolean, is_active)
    where id = v_id and club_id = private.my_club();
    if not found then raise exception 'Modelul nu a fost găsit.' using errcode = 'P0002'; end if;
  end if;
  select v.version, v.body into v_ver, v_last from public.contract_template_versions v where v.template_id = v_id order by v.version desc limit 1;
  if p ? 'body' and (v_last is null or v_last <> p->>'body') then
    insert into public.contract_template_versions (template_id, version, body, created_by) values (v_id, coalesce(v_ver, 0) + 1, p->>'body', app_auth.uid());
  end if;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Trimiterea: pentru fiecare jucător, semnatarul = părintele plătitor cu cont (sau primul părinte cu cont),
-- iar jucătorul adult cu cont își semnează singur dacă nu are părinte în aplicație.
-- Câmpuri înlocuite: {{club}} {{jucator}} {{data_nasterii}} {{echipa}} {{parinte}} {{data}} {{sezon}}
-- ---------------------------------------------------------------------------
create or replace function private.render_contract(p_body text, p_player uuid, p_signer text) returns text
language sql stable security definer set search_path = '' as $$
  select replace(replace(replace(replace(replace(replace(replace(p_body,
    '{{club}}', coalesce(c.name, '')),
    '{{jucator}}', coalesce(pl.full_name, '')),
    '{{data_nasterii}}', coalesce(to_char(pl.birth_date, 'DD.MM.YYYY'), '')),
    '{{echipa}}', coalesce(g.name, '')),
    '{{parinte}}', coalesce(p_signer, '')),
    '{{data}}', to_char(private.club_today(pl.club_id), 'DD.MM.YYYY')),
    '{{sezon}}', to_char(private.club_today(pl.club_id), 'YYYY') || '–' || (to_char(private.club_today(pl.club_id), 'YYYY')::int + 1))
  from public.players pl join public.clubs c on c.id = pl.club_id left join public.groups g on g.id = pl.group_id
  where pl.id = p_player
$$;

create or replace function public.send_contracts(p_template uuid, p_players uuid[], p_due_on date default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); v_ver record; v_name text; v_pl record; v_user uuid; v_sname text; v_id uuid; v_sent int := 0; v_skipped jsonb := '[]'::jsonb;
begin
  if not private.can_manage_contracts() then raise exception 'Doar biroul trimite contracte.' using errcode = '42501'; end if;
  select t.name into v_name from public.contract_templates t where t.id = p_template and t.club_id = v_club and t.is_active;
  if v_name is null then raise exception 'Modelul nu a fost găsit.' using errcode = 'P0002'; end if;
  select v.* into v_ver from public.contract_template_versions v where v.template_id = p_template order by v.version desc limit 1;
  if v_ver is null then raise exception 'Modelul nu are text.' using errcode = '22023'; end if;
  for v_pl in select pl.id, pl.display_name, pl.full_name, pl.user_id from public.players pl
              where pl.id = any (p_players) and pl.club_id = v_club and pl.is_active and pl.anonymized_at is null loop
    v_user := null; v_sname := null;
    select g.user_id, g.full_name into v_user, v_sname
    from public.guardian_players gp join public.guardians g on g.id = gp.guardian_id and g.deleted_at is null and g.user_id is not null
    where gp.player_id = v_pl.id order by gp.is_billing desc, g.created_at limit 1;
    if v_user is null and v_pl.user_id is not null then
      v_user := v_pl.user_id; v_sname := v_pl.full_name;
    end if;
    if v_user is null then
      v_skipped := v_skipped || jsonb_build_object('player', v_pl.display_name);
      continue;
    end if;
    if exists (select 1 from public.contracts c where c.player_id = v_pl.id and c.template_version_id = v_ver.id and c.status in ('sent', 'signed')) then
      continue;
    end if;
    insert into public.contracts (club_id, template_version_id, title, player_id, signer_user_id, signer_name, body, due_on, sent_by)
    values (v_club, v_ver.id, v_name, v_pl.id, v_user, v_sname, private.render_contract(v_ver.body, v_pl.id, v_sname), p_due_on, app_auth.uid())
    returning id into v_id;
    insert into public.contract_events (contract_id, actor_id, action) values (v_id, app_auth.uid(), 'sent');
    perform private.notify(v_user, 'contract_sign', 'Document de semnat: ' || v_name, v_pl.display_name, '/contracte/' || v_id, 'contract:' || v_id);
    v_sent := v_sent + 1;
  end loop;
  return jsonb_build_object('sent', v_sent, 'skipped', v_skipped);
end $$;

/** Deschiderea de către semnatar (o dată pe zi în urma de audit). */
create or replace function public.view_contract(p_id uuid, p_ip text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.contracts c where c.id = p_id and c.signer_user_id = app_auth.uid()) then return; end if;
  if not exists (select 1 from public.contract_events e where e.contract_id = p_id and e.action = 'viewed' and e.actor_id = app_auth.uid()
                   and e.at > now() - interval '1 day') then
    insert into public.contract_events (contract_id, actor_id, action, ip) values (p_id, app_auth.uid(), 'viewed', left(p_ip, 64));
  end if;
end $$;

/**
 * Semnarea: doar semnatarul, doar un document trimis, cu numele scris și semnătura desenată (încărcată înainte).
 * Amprenta (sha256) leagă textul, numele, momentul și fișierul semnăturii.
 */
create or replace function public.sign_contract(p_id uuid, p_name text, p_signature_path text, p_ip text default null, p_user_agent text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v_c record; v_at timestamptz := now(); v_hash text;
begin
  select * into v_c from public.contracts where id = p_id for update;
  if not found or v_c.signer_user_id is distinct from app_auth.uid() then raise exception 'Documentul nu a fost găsit.' using errcode = 'P0002'; end if;
  if v_c.status <> 'sent' then raise exception 'Documentul nu mai așteaptă semnătura.' using errcode = '22023'; end if;
  if length(trim(coalesce(p_name, ''))) < 3 then raise exception 'Scrie-ți numele complet.' using errcode = '22023'; end if;
  if p_signature_path is null or p_signature_path not like v_c.club_id || '/' || p_id || '/%' then
    raise exception 'Semnătura lipsește. Desenează-o din nou.' using errcode = '22023';
  end if;
  v_hash := encode(sha256(convert_to(v_c.body || E'\n--\n' || trim(p_name) || E'\n' || to_char(v_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || E'\n' || p_signature_path, 'UTF8')), 'hex');
  update public.contracts set status = 'signed', signed_at = v_at, signed_name = trim(p_name), signature_path = p_signature_path,
    signed_ip = left(p_ip, 64), signed_user_agent = left(p_user_agent, 300), document_hash = v_hash
  where id = p_id;
  insert into public.contract_events (contract_id, actor_id, action, ip, details) values (p_id, app_auth.uid(), 'signed', left(p_ip, 64), v_hash);
  update public.notifications set read_at = coalesce(read_at, now()) where user_id = app_auth.uid() and dedupe_key = 'contract:' || p_id;
  return v_hash;
end $$;

create or replace function public.decline_contract(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Spune-ne de ce, ca biroul să poată corecta.' using errcode = '22023'; end if;
  update public.contracts set status = 'declined', decline_reason = left(trim(p_reason), 500)
  where id = p_id and signer_user_id = app_auth.uid() and status = 'sent';
  if not found then raise exception 'Documentul nu mai așteaptă semnătura.' using errcode = '22023'; end if;
  insert into public.contract_events (contract_id, actor_id, action, details) values (p_id, app_auth.uid(), 'declined', left(trim(p_reason), 500));
  perform private.notify_users(private.my_club(), array['admin', 'secretary']::public.app_role[], 'contract_sign',
    'Document refuzat: ' || (select title from public.contracts where id = p_id), left(trim(p_reason), 200), '/club/contracte', 'contract_declined:' || p_id);
end $$;

create or replace function public.void_contract(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_contracts() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  update public.contracts set status = 'voided', void_reason = left(trim(p_reason), 500)
  where id = p_id and club_id = private.my_club() and status in ('sent', 'declined');
  if not found then raise exception 'Doar documentele nesemnate se pot anula.' using errcode = '22023'; end if;
  insert into public.contract_events (contract_id, actor_id, action, details) values (p_id, app_auth.uid(), 'voided', left(trim(p_reason), 500));
end $$;

/** Reamintirea manuală (o dată pe zi pe document). */
create or replace function public.remind_contracts(p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare r record; v_n int := 0;
begin
  if not private.can_manage_contracts() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  for r in select * from public.contracts where id = any (p_ids) and club_id = private.my_club() and status = 'sent'
             and (last_reminded_at is null or last_reminded_at < now() - interval '20 hours') loop
    perform private.notify(r.signer_user_id, 'contract_sign', 'Reamintire: ' || r.title, 'Documentul așteaptă semnătura ta.', '/contracte/' || r.id,
      'contract_remind:' || r.id || ':' || to_char(now(), 'YYYYMMDD'));
    update public.contracts set reminders_sent = reminders_sent + 1, last_reminded_at = now() where id = r.id;
    insert into public.contract_events (contract_id, actor_id, action) values (r.id, app_auth.uid(), 'reminded');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

/** Sarcina programată: la 3 zile, cel mult 3 reamintiri automate pe document. */
create or replace function public.run_contract_reminders() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; v_n int := 0;
begin
  if app_auth.role() <> 'service_role' then raise exception 'Doar sarcina programată.' using errcode = '42501'; end if;
  for r in select * from public.contracts where status = 'sent' and reminders_sent < 3
             and coalesce(last_reminded_at, sent_at) < now() - interval '3 days' limit 500 loop
    perform private.notify(r.signer_user_id, 'contract_sign', 'Reamintire: ' || r.title, 'Documentul așteaptă semnătura ta.', '/contracte/' || r.id,
      'contract_remind:' || r.id || ':' || to_char(now(), 'YYYYMMDD'));
    update public.contracts set reminders_sent = reminders_sent + 1, last_reminded_at = now() where id = r.id;
    insert into public.contract_events (contract_id, action, details) values (r.id, 'reminded', 'automat');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

revoke all on function public.run_contract_reminders() from public, anon, authenticated;
grant execute on function public.run_contract_reminders() to service_role;
grant execute on function public.save_contract_template(jsonb), public.send_contracts(uuid, uuid[], date), public.view_contract(uuid, text),
  public.sign_contract(uuid, text, text, text, text), public.decline_contract(uuid, text), public.void_contract(uuid, text),
  public.remind_contracts(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Depozitul „contracts": <club>/<contract>/semnatura-<uuid>.png
-- ---------------------------------------------------------------------------
create or replace function private.contract_file_access(p_path text, p_action text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.contracts c
    where c.id = private.try_uuid(split_part(p_path, '/', 2)) and c.club_id = private.my_club()
      and case p_action
            when 'read' then c.signature_path = p_path and (private.can_manage_contracts() or c.signer_user_id = app_auth.uid())
            when 'write' then c.status = 'sent' and c.signer_user_id = app_auth.uid() and split_part(p_path, '/', 3) like 'semnatura-%'
            else false end
  )
$$;
grant execute on function private.contract_file_access(text, text) to authenticated;

do $$
declare v_src text;
begin
  select pg_get_functiondef('private.file_access_lr(text, text, text, uuid, public.app_role)'::regprocedure) into v_src;
  if position('contract_file_access' in v_src) = 0 then
    v_src := replace(v_src, E'  end if;\n  return false;\nend', E'  elsif p_bucket = ''contracts'' then\n    if p_owner is distinct from (select private.my_club()) then return false; end if;\n    return private.contract_file_access(p_path, p_action);\n  end if;\n  return false;\nend');
    if position('contract_file_access' in v_src) = 0 then raise exception 'file_access_lr: punctul de inserare nu a fost găsit'; end if;
    execute v_src;
  end if;
end $$;

-- GDPR: contractele semnate sunt documente ale părintelui (obligație legală de păstrare); la ștergerea jucătorului
-- legătura player_id devine nulă, textul rămâne.
