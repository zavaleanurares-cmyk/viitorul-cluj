-- Locker Room faza 4 · Vize medicale: părintele (sau jucătorul adult) încarcă avizul, biroul îl verifică
-- și setează noua dată de expirare; mementouri la 30 și 7 zile înainte și după expirare.

-- ---------------------------------------------------------------------------
-- Cine verifică vizele: administratorul, secretariatul, preparatorul fizic.
-- ---------------------------------------------------------------------------
create or replace function private.can_manage_visas() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.my_role()) in ('admin', 'secretary', 'physio'), false)
$$;
grant execute on function private.can_manage_visas() to authenticated;

create table public.visa_documents (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  player_id     uuid not null references public.players(id) on delete cascade,
  storage_path  text not null unique,           -- în depozitul „visas": <jucător>/<uuid>-<nume>
  file_name     text,
  mime_type     text,
  size_bytes    bigint,
  issued_on     date,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  valid_until   date,
  reject_reason text,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  uploaded_at   timestamptz not null default now(),
  decided_by    uuid references public.profiles(id) on delete set null,
  decided_at    timestamptz,
  check (status <> 'approved' or valid_until is not null),
  check (status <> 'rejected' or nullif(trim(reject_reason), '') is not null)
);
create index visa_documents_player_idx on public.visa_documents (player_id, uploaded_at desc);
create index visa_documents_pending_idx on public.visa_documents (club_id) where status = 'pending';

alter table public.visa_documents enable row level security;
create policy visa_documents_select on public.visa_documents for select to authenticated
  using (club_id = (select private.my_club())
     and ((select private.is_office()) or (select private.can_manage_visas())
          or private.can_read_player_summary(player_id)
          or player_id = any ((select private.my_player_ids())::uuid[])));
-- scrierile trec doar prin funcțiile de mai jos (verifică dreptul, calea și starea)
grant select on public.visa_documents to authenticated;

create trigger visa_documents_audit after insert or update or delete on public.visa_documents
  for each row execute function private.audit();

-- ---------------------------------------------------------------------------
-- Trimiterea unui document
-- ---------------------------------------------------------------------------
create or replace function public.submit_visa_document(
  p_player uuid, p_path text, p_file_name text, p_mime text, p_size bigint, p_issued_on date default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); v_name text; v_id uuid;
begin
  select pl.display_name into v_name from public.players pl
  where pl.id = p_player and pl.club_id = v_club and pl.is_active and pl.anonymized_at is null;
  if v_name is null then raise exception 'Jucătorul nu a fost găsit.' using errcode = 'P0002'; end if;
  if not (p_player = any (private.my_player_ids()) or private.can_manage_visas()) then
    raise exception 'Nu poți trimite documente pentru acest jucător.' using errcode = '42501';
  end if;
  if p_path is null or split_part(p_path, '/', 1) <> p_player::text or p_path like '%..%'
     or exists (select 1 from public.visa_documents d where d.storage_path = p_path) then
    raise exception 'Fișierul nu a fost găsit. Încarcă-l din nou.' using errcode = '22023';
  end if;
  if p_issued_on is not null and p_issued_on > private.club_today(v_club) then
    raise exception 'Data emiterii nu poate fi în viitor.' using errcode = '22023';
  end if;
  insert into public.visa_documents (club_id, player_id, storage_path, file_name, mime_type, size_bytes, issued_on, uploaded_by)
  values (v_club, p_player, p_path, left(p_file_name, 200), left(p_mime, 100), p_size, p_issued_on, app_auth.uid())
  returning id into v_id;
  perform private.notify_users(v_club, array['admin', 'secretary', 'physio']::public.app_role[], 'visa_document',
    'Viză medicală de verificat: ' || v_name, 'Documentul așteaptă aprobarea.', '/lot/vize', 'visa_doc:' || v_id, app_auth.uid());
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Verificarea: aprobarea setează data de expirare a vizei; respingerea cere motiv.
-- ---------------------------------------------------------------------------
create or replace function public.decide_visa_document(
  p_id uuid, p_approve boolean, p_valid_until date default null, p_issued_on date default null, p_reason text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_doc record; v_name text; v_today date;
begin
  if not private.can_manage_visas() then
    raise exception 'Doar biroul sau preparatorul verifică vizele.' using errcode = '42501';
  end if;
  select d.* into v_doc from public.visa_documents d where d.id = p_id and d.club_id = private.my_club() for update;
  if not found then raise exception 'Documentul nu mai există.' using errcode = 'P0002'; end if;
  if v_doc.status <> 'pending' then raise exception 'Documentul a fost deja verificat.' using errcode = '22023'; end if;
  v_today := private.club_today(v_doc.club_id);
  select pl.display_name into v_name from public.players pl where pl.id = v_doc.player_id;

  if p_approve then
    if p_valid_until is null or p_valid_until <= v_today
       or (coalesce(p_issued_on, v_doc.issued_on) is not null and p_valid_until <= coalesce(p_issued_on, v_doc.issued_on))
       or coalesce(p_issued_on, v_doc.issued_on) > v_today then
      raise exception 'Data de valabilitate trebuie să fie după data emiterii și în viitor.' using errcode = '22023';
    end if;
    update public.visa_documents set status = 'approved', valid_until = p_valid_until,
      issued_on = coalesce(p_issued_on, issued_on), decided_by = app_auth.uid(), decided_at = now()
    where id = p_id;
    update public.players set medical_visa_expires_on = p_valid_until where id = v_doc.player_id;
    perform private.notify(v_doc.uploaded_by, 'visa_document', 'Viza medicală a lui ' || v_name || ' a fost aprobată',
      'Valabilă până la ' || to_char(p_valid_until, 'DD.MM.YYYY') || '.', '/azi', 'visa_doc_done:' || p_id);
  else
    if nullif(trim(p_reason), '') is null then
      raise exception 'Scrie motivul, ca familia să știe ce să corecteze.' using errcode = '22023';
    end if;
    update public.visa_documents set status = 'rejected', reject_reason = left(trim(p_reason), 500),
      decided_by = app_auth.uid(), decided_at = now()
    where id = p_id;
    perform private.notify(v_doc.uploaded_by, 'visa_document', 'Documentul pentru viza lui ' || v_name || ' a fost respins',
      left(trim(p_reason), 300), '/azi', 'visa_doc_done:' || p_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Mementouri: la 30 de zile, la 7 zile și după expirare (o singură dată pe prag și pe dată de expirare).
-- Merg la părinții cu cont și la jucătorul cu cont.
-- ---------------------------------------------------------------------------
create or replace function private.visa_reminder_targets(p_player uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select g.user_id from public.guardian_players gp
  join public.guardians g on g.id = gp.guardian_id and g.deleted_at is null and g.user_id is not null
  where gp.player_id = p_player
  union
  select pl.user_id from public.players pl where pl.id = p_player and pl.user_id is not null
$$;

create or replace function private.send_visa_reminder(p_player uuid, p_key text) returns int
language plpgsql security definer set search_path = '' as $$
declare v_pl record; v_user uuid; v_n int := 0; v_title text;
begin
  select pl.display_name, pl.medical_visa_expires_on as exp, pl.club_id into v_pl from public.players pl where pl.id = p_player;
  v_title := case
    when v_pl.exp is null then 'Lipsește viza medicală a lui ' || v_pl.display_name
    when v_pl.exp < private.club_today(v_pl.club_id) then 'Viza medicală a lui ' || v_pl.display_name || ' a expirat'
    else 'Viza medicală a lui ' || v_pl.display_name || ' expiră pe ' || to_char(v_pl.exp, 'DD.MM.YYYY') end;
  for v_user in select * from private.visa_reminder_targets(p_player) loop
    insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
    values (v_user, 'visa_reminder', v_title, 'Încarcă noul aviz medical sportiv din aplicație; fără viză valabilă nu poate juca.', '/azi', p_key)
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    if found then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end $$;

/** Rularea zilnică (cron): toate cluburile. */
create or replace function public.run_visa_reminders() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; v_n int := 0; v_bucket text;
begin
  if app_auth.role() <> 'service_role' then raise exception 'Doar sarcina programată.' using errcode = '42501'; end if;
  for r in
    select pl.id, pl.medical_visa_expires_on as exp, private.club_today(pl.club_id) as today
    from public.players pl
    where pl.is_active and pl.anonymized_at is null and pl.medical_visa_expires_on is not null
      and pl.medical_visa_expires_on <= private.club_today(pl.club_id) + 30
      and pl.medical_visa_expires_on >= private.club_today(pl.club_id) - 30
      -- un document trimis și neverificat încă oprește mementourile
      and not exists (select 1 from public.visa_documents d where d.player_id = pl.id and d.status = 'pending')
  loop
    v_bucket := case when r.exp < r.today then 'expired' when r.exp <= r.today + 7 then '7' else '30' end;
    v_n := v_n + private.send_visa_reminder(r.id, 'visa:' || r.id || ':' || r.exp || ':' || v_bucket);
  end loop;
  return v_n;
end $$;

/** Reamintirea trimisă de birou acum (o dată pe zi pe jucător). Întoarce câte conturi au primit-o. */
create or replace function public.send_visa_reminders(p_players uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_n int := 0; v_club uuid := private.my_club();
begin
  if not private.can_manage_visas() then raise exception 'Doar biroul trimite reamintiri.' using errcode = '42501'; end if;
  for v_id in select pl.id from public.players pl where pl.id = any (p_players) and pl.club_id = v_club and pl.is_active loop
    v_n := v_n + private.send_visa_reminder(v_id, 'visa_manual:' || v_id || ':' || private.club_today(v_club));
  end loop;
  return v_n;
end $$;

revoke all on function public.run_visa_reminders() from public, anon;
grant execute on function public.submit_visa_document(uuid, text, text, text, bigint, date), public.decide_visa_document(uuid, boolean, date, date, text),
  public.send_visa_reminders(uuid[]) to authenticated;
grant execute on function public.run_visa_reminders() to service_role;

-- ---------------------------------------------------------------------------
-- Depozitul „visas" și, de acum, celelalte depozite din faza 4 trec printr-o funcție separată,
-- ca `file_access` să nu mai fie rescrisă la fiecare modul.
-- ---------------------------------------------------------------------------
create or replace function private.file_access_lr(p_bucket text, p_path text, p_action text, p_owner uuid, p_role public.app_role)
returns boolean language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_bucket = 'visas' then
    -- <jucător>/<fișier>
    if p_action = 'read' then
      return exists (select 1 from public.visa_documents d where d.storage_path = p_path);
    elsif p_action = 'write' then
      return (p_owner = any ((select private.my_player_ids())::uuid[]) or (select private.can_manage_visas()))
         and exists (select 1 from public.players pl where pl.id = p_owner and pl.club_id = (select private.my_club()))
         and not exists (select 1 from public.visa_documents d where d.storage_path = p_path);
    end if;
    return (select private.can_manage_visas());
  end if;
  return false;
end $$;
grant execute on function private.file_access_lr(text, text, text, uuid, public.app_role) to authenticated;

-- file_access (faza 3) + trimiterea către file_access_lr pentru depozitele noi
do $$
declare v_src text;
begin
  select pg_get_functiondef('public.file_access(text, text, text)'::regprocedure) into v_src;
  if position('file_access_lr' in v_src) = 0 then
    v_src := replace(v_src,
      E'  elsif p_bucket = ''branding'' then',
      E'  elsif p_bucket in (''visas'', ''videos'', ''contracts'', ''shop'', ''site'', ''messages'') then\n    return private.file_access_lr(p_bucket, p_path, p_action, v_owner, v_role);\n\n  elsif p_bucket = ''branding'' then');
    if position('file_access_lr' in v_src) = 0 then raise exception 'file_access: punctul de inserare nu a fost găsit'; end if;
    execute v_src;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- GDPR: datele din modulele fazei 4 se curăță la anonimizare / ștergere.
--   private.scrub_player_lr  — rândurile (apelată din scrub_player_traces);
--   public.player_file_paths — fișierele de șters din depozit înainte de rânduri (aplicația le șterge).
-- Fiecare modul nou al fazei 4 își adaugă aici tabelele.
-- ---------------------------------------------------------------------------
create or replace function private.scrub_player_lr(p_player uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.visa_documents where player_id = p_player;
  delete from public.notifications n
  where coalesce(p_name, '') <> '' and n.kind in ('visa_document', 'visa_reminder') and n.title like '%' || p_name || '%';
end $$;
revoke all on function private.scrub_player_lr(uuid, text) from public;

create or replace function public.player_file_paths(p_player uuid) returns table (bucket text, path text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_manage_player(p_player) then raise exception 'Acces interzis' using errcode = '42501'; end if;
  return query select 'visas'::text, d.storage_path from public.visa_documents d where d.player_id = p_player;
end $$;
grant execute on function public.player_file_paths(uuid) to authenticated;

do $$
declare v_src text;
begin
  select pg_get_functiondef('private.scrub_player_traces(uuid, uuid, uuid, text)'::regprocedure) into v_src;
  if position('scrub_player_lr' in v_src) = 0 then
    v_src := replace(v_src, $q$  delete from public.notifications n
  where n.link like '/jucatori/' || p_player::text || '%'$q$, $q$  perform private.scrub_player_lr(p_player, p_name);

  delete from public.notifications n
  where (n.link like '/jucatori/' || p_player::text || '%' or n.link like '/lot/jucatori/' || p_player::text || '%')$q$);
    if position('scrub_player_lr' in v_src) = 0 then raise exception 'scrub_player_traces: punctul de inserare nu a fost găsit'; end if;
    execute v_src;
  end if;
end $$;
