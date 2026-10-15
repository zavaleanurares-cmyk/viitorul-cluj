-- Locker Room · Faza 4 · Club: corecturi după revizia de securitate.
--   1. Minorii nu semnează documente (nici acordul foto); tipul documentului se păstrează pe contract.
--   2. Fotografiile noi sunt ascunse până când biroul le verifică (etichetează copiii sau confirmă că nu e nimeni de etichetat).
--   3. Locurile din tabere: rândul taberei se blochează la numărare (fără suprarezervări la cereri simultane).
--   4. Imaginile știrilor în aplicație: doar ale știrilor publicate pe care utilizatorul le poate vedea.
--   5. Kinetoterapeutul trimite mesaje doar alegând echipele (nu tot clubului dintr-o dată).
--   6. GDPR: numele copilului șters dispare și din comenzi, destinatarii mesajelor și notificările noi.
--   7. Paginile publice respectă secțiunile oprite din setări; limitele zilnice ale formularelor, mai largi.
--   8. Înscrierea nu leagă automat copilul de un părinte existent cu aceeași adresă: biroul confirmă.
--   9. Funcțiile interne nu se pot apela direct.

alter table public.contracts add column kind text;
update public.contracts c set kind = t.kind from public.contract_template_versions v join public.contract_templates t on t.id = v.template_id
where v.id = c.template_version_id and c.kind is null;
grant select (kind) on public.contracts to authenticated;

create or replace function public.send_contracts(p_template uuid, p_players uuid[], p_due_on date default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); v_ver record; v_name text; v_kind text; v_pl record; v_user uuid; v_sname text; v_id uuid; v_sent int := 0; v_skipped jsonb := '[]'::jsonb;
begin
  if not private.can_manage_contracts() then raise exception 'Doar biroul trimite contracte.' using errcode = '42501'; end if;
  select t.name, t.kind into v_name, v_kind from public.contract_templates t where t.id = p_template and t.club_id = v_club and t.is_active;
  if v_name is null then raise exception 'Modelul nu a fost găsit.' using errcode = 'P0002'; end if;
  select v.* into v_ver from public.contract_template_versions v where v.template_id = p_template order by v.version desc limit 1;
  if v_ver is null then raise exception 'Modelul nu are text.' using errcode = '22023'; end if;
  for v_pl in select pl.id, pl.display_name, pl.full_name, pl.user_id, pl.birth_date from public.players pl
              where pl.id = any (p_players) and pl.club_id = v_club and pl.is_active and pl.anonymized_at is null loop
    v_user := null; v_sname := null;
    select g.user_id, g.full_name into v_user, v_sname
    from public.guardian_players gp join public.guardians g on g.id = gp.guardian_id and g.deleted_at is null and g.user_id is not null
    where gp.player_id = v_pl.id order by gp.is_billing desc, g.created_at limit 1;
    -- jucătorul își semnează singur doar dacă e major
    if v_user is null and v_pl.user_id is not null and v_pl.birth_date is not null and v_pl.birth_date <= private.club_today(v_club) - interval '18 years' then
      v_user := v_pl.user_id; v_sname := v_pl.full_name;
    end if;
    if v_user is null then
      v_skipped := v_skipped || jsonb_build_object('player', v_pl.display_name);
      continue;
    end if;
    if exists (select 1 from public.contracts c where c.player_id = v_pl.id and c.template_version_id = v_ver.id and c.status in ('sent', 'signed')) then
      continue;
    end if;
    insert into public.contracts (club_id, kind, template_version_id, title, player_id, signer_user_id, signer_name, body, due_on, sent_by)
    values (v_club, v_kind, v_ver.id, v_name, v_pl.id, v_user, v_sname, private.render_contract(v_ver.body, v_pl.id, v_sname), p_due_on, app_auth.uid())
    returning id into v_id;
    insert into public.contract_events (contract_id, actor_id, action) values (v_id, app_auth.uid(), 'sent');
    perform private.notify(v_user, 'contract_sign', 'Document de semnat: ' || v_name, v_pl.display_name, '/contracte/' || v_id, 'contract:' || v_id);
    v_sent := v_sent + 1;
  end loop;
  return jsonb_build_object('sent', v_sent, 'skipped', v_skipped);
end $$;
create or replace function public.sign_contract(p_id uuid, p_name text, p_signature_path text, p_ip text default null, p_user_agent text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v_c record; v_at timestamptz := now(); v_hash text;
begin
  select * into v_c from public.contracts where id = p_id for update;
  if not found or v_c.signer_user_id is distinct from app_auth.uid() then raise exception 'Documentul nu a fost găsit.' using errcode = 'P0002'; end if;
  if exists (select 1 from public.players pl where pl.user_id = app_auth.uid() and pl.id = v_c.player_id
               and (pl.birth_date is null or pl.birth_date > private.club_today(v_c.club_id) - interval '18 years')) then
    raise exception 'Documentul trebuie semnat de un părinte.' using errcode = '42501';
  end if;
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
create or replace function private.contract_photo_consent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'signed' and old.status is distinct from 'signed' and new.player_id is not null and new.kind = 'photo_consent' then
    update public.players set photo_consent = true where id = new.player_id;
  end if;
  return new;
end $$;

alter table public.site_photos add column reviewed boolean not null default false;
update public.site_photos set reviewed = true;

create or replace function private.photo_is_public(p_photo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.site_photos ph join public.site_albums a on a.id = ph.album_id and a.status = 'published'
    join public.clubs c on c.id = ph.club_id and coalesce((c.settings->'site'->>'gallery')::boolean, true)
    where ph.id = p_photo and ph.reviewed
      and not exists (select 1 from public.players pl where pl.id = any (ph.player_ids) and (not pl.photo_consent or pl.anonymized_at is not null)))
$$;

create or replace function public.save_photo(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); v_id uuid := nullif(p->>'id', '')::uuid; v_players uuid[];
begin
  if not private.can_manage_website() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  select coalesce(array_agg(pl.id), '{}') into v_players from public.players pl
  where pl.club_id = v_club and pl.id::text in (select jsonb_array_elements_text(coalesce(p->'player_ids', '[]'::jsonb)));
  if v_id is null then
    if not exists (select 1 from public.site_albums a where a.id = (p->>'album_id')::uuid and a.club_id = v_club) then
      raise exception 'Albumul nu a fost găsit.' using errcode = 'P0002';
    end if;
    if (p->>'path') not like v_club::text || '/foto/%' then raise exception 'Fișier invalid.' using errcode = '22023'; end if;
    insert into public.site_photos (album_id, club_id, path, caption, player_ids, sort)
    values ((p->>'album_id')::uuid, v_club, p->>'path', nullif(trim(p->>'caption'), ''), v_players,
            coalesce((select max(sort) + 1 from public.site_photos where album_id = (p->>'album_id')::uuid), 0))
    returning id into v_id;
  else
    update public.site_photos set caption = nullif(trim(p->>'caption'), ''), player_ids = v_players, reviewed = true where id = v_id and club_id = v_club;
    if not found then raise exception 'Fotografia nu a fost găsită.' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end $$;
drop function public.photo_consent_state(uuid);
create or replace function public.photo_consent_state(p_album uuid)
returns table (photo_id uuid, is_public boolean, missing text[], reviewed boolean)
language sql stable security definer set search_path = '' as $$
  select ph.id, private.photo_is_public(ph.id),
         coalesce((select array_agg(pl.full_name order by pl.full_name) from public.players pl
                   where pl.id = any (ph.player_ids) and not pl.photo_consent), '{}'), ph.reviewed
  from public.site_photos ph
  where ph.album_id = p_album and ph.club_id = private.my_club() and private.can_manage_website()
$$;
grant execute on function public.photo_consent_state(uuid) to authenticated;

create or replace function private.lock_camp(p_camp uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.camps where id = p_camp for update;
end $$;

create or replace function private.camp_open_for(p_camp uuid, p_club uuid) returns record
language plpgsql security definer set search_path = '' as $$
declare v_c record;
begin
  select * into v_c from public.camps where id = p_camp and club_id = p_club for update;
  if not found then raise exception 'Tabăra nu a fost găsită.' using errcode = 'P0002'; end if;
  if v_c.status <> 'open' then raise exception 'Înscrierile la această tabără sunt închise.' using errcode = '22023'; end if;
  if coalesce(v_c.deadline, v_c.starts_on) < private.club_today(p_club) then
    raise exception 'Termenul de înscriere a trecut.' using errcode = '22023';
  end if;
  return v_c;
end $$;
create or replace function private.promote_camp_waitlist(p_camp uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare v_c record; v_r record; v_n int := 0;
begin
  select * into v_c from public.camps where id = p_camp for update;
  if v_c.status not in ('open', 'closed') then return 0; end if;
  for v_r in select id from public.camp_registrations where camp_id = p_camp and status = 'waitlist' order by created_at loop
    exit when private.camp_taken(p_camp) >= v_c.capacity;
    perform private.confirm_camp_spot(v_r.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
create or replace function public.confirm_camp_registration(p_id uuid, p_player uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_r record; v_c record;
begin
  if not private.can_manage_camps() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  select * into v_r from public.camp_registrations where id = p_id and club_id = private.my_club() for update;
  if not found then raise exception 'Înscrierea nu a fost găsită.' using errcode = 'P0002'; end if;
  if v_r.status not in ('pending', 'waitlist') then raise exception 'Înscrierea e deja confirmată sau anulată.' using errcode = '22023'; end if;
  select * into v_c from public.camps where id = v_r.camp_id for update;
  if private.camp_taken(v_r.camp_id) >= v_c.capacity then raise exception 'Tabăra este plină.' using errcode = '22023'; end if;
  if p_player is not null then
    if not exists (select 1 from public.players where id = p_player and club_id = v_r.club_id) then raise exception 'Jucătorul nu a fost găsit.' using errcode = 'P0002'; end if;
    update public.camp_registrations set player_id = p_player where id = p_id;
  end if;
  perform private.confirm_camp_spot(p_id);
end $$;
create or replace function public.cancel_camp_registration(p_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_r record; v_c record; v_paid boolean := false;
begin
  select * into v_r from public.camp_registrations where id = p_id and club_id = private.my_club() for update;
  if not found then raise exception 'Înscrierea nu a fost găsită.' using errcode = 'P0002'; end if;
  select * into v_c from public.camps where id = v_r.camp_id for update;
  if not private.can_manage_camps() then
    if not (v_r.registered_by = app_auth.uid() or v_r.player_id = any (private.my_player_ids())) then raise exception 'Acces interzis' using errcode = '42501'; end if;
    if v_c.starts_on <= private.club_today(v_r.club_id) then raise exception 'Tabăra a început; anunță biroul clubului.' using errcode = '22023'; end if;
  end if;
  if v_r.status = 'cancelled' then return; end if;
  if v_r.charge_id is not null then
    v_paid := exists (select 1 from public.allocations a where a.charge_id = v_r.charge_id);
    if not v_paid then
      update public.charges set status = 'cancelled', cancel_reason = 'Înscriere la tabără anulată' where id = v_r.charge_id and status = 'open';
    else
      perform private.notify_users(v_r.club_id, array['accountant', 'admin']::public.app_role[], 'camp',
        'Restituire de verificat: ' || v_c.title, v_r.child_name || ' a renunțat după plată.', '/bani', 'camp_refund:' || p_id);
    end if;
  end if;
  update public.camp_registrations set status = 'cancelled', cancel_reason = nullif(trim(p_reason), ''), updated_at = now() where id = p_id;
  perform private.promote_camp_waitlist(v_r.camp_id);
end $$;
create or replace function public.submit_camp_registration(p_slug text, p_camp uuid, p jsonb, p_ip text default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.club_by_slug(p_slug); v_c record; v_id uuid; v_birth date := (p->>'birth_date')::date;
begin
  if v_club is null then raise exception 'Clubul nu a fost găsit.' using errcode = 'P0002'; end if;
  v_c := private.camp_open_for(p_camp, v_club);
  if not v_c.is_public then raise exception 'Tabăra nu a fost găsită.' using errcode = 'P0002'; end if;
  if coalesce((p->>'consent')::boolean, false) is not true then raise exception 'Este nevoie de acordul pentru prelucrarea datelor.' using errcode = '22023'; end if;
  if v_birth is null or not private.camp_age_ok(p_camp, v_birth) then raise exception 'Tabăra este pentru alți ani de naștere.' using errcode = '22023'; end if;
  if nullif(trim(p->>'parent_email'), '') is null and nullif(trim(p->>'parent_phone'), '') is null then
    raise exception 'Scrie un e-mail sau un telefon.' using errcode = '22023';
  end if;
  if not private.public_hit(v_club, 'camp', p_ip, 5, 1000) then
    raise exception 'Prea multe trimiteri. Încearcă din nou peste o oră.' using errcode = '54000';
  end if;
  insert into public.camp_registrations (camp_id, club_id, child_name, birth_date, parent_name, parent_email, parent_phone, notes, status, source, consent_at)
  values (p_camp, v_club, trim(p->>'child_name'), v_birth, trim(p->>'parent_name'), nullif(lower(trim(p->>'parent_email')), ''),
          nullif(regexp_replace(coalesce(p->>'parent_phone', ''), '[^0-9+]', '', 'g'), ''), nullif(trim(p->>'notes'), ''),
          'pending', 'public', now())
  returning id into v_id;
  perform private.notify_users(v_club, array['admin', 'secretary']::public.app_role[], 'camp',
    'Înscriere de pe site: ' || v_c.title, trim(p->>'child_name'), '/club/tabere/' || p_camp, 'camp_reg:' || v_id);
  return true;
end $$;
create or replace function public.submit_enrolment_request(p_slug text, p jsonb, p_ip text default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.club_by_slug(p_slug); v_id uuid;
begin
  if v_club is null then raise exception 'Clubul nu a fost găsit.' using errcode = 'P0002'; end if;
  if coalesce((select c.settings->'site'->>'enrolment' from public.clubs c where c.id = v_club), 'true') = 'false' then
    raise exception 'Înscrierile online sunt închise.' using errcode = '22023';
  end if;
  if coalesce((p->>'consent')::boolean, false) is not true then
    raise exception 'Este nevoie de acordul pentru prelucrarea datelor.' using errcode = '22023';
  end if;
  if not private.public_hit(v_club, 'enrolment', p_ip, 5, 500) then
    raise exception 'Prea multe trimiteri. Încearcă din nou peste o oră.' using errcode = '54000';
  end if;
  v_id := private.insert_enrolment(v_club, p, 'public');
  perform private.notify_users(v_club, array['admin', 'secretary', 'sporting_director']::public.app_role[], 'enrolment',
    'Cerere de înscriere: ' || trim(p->>'child_name'), to_char((p->>'birth_date')::date, 'YYYY'), '/club/inscrieri/' || v_id, 'enrolment:' || v_id);
  return true;
end $$;
create or replace function private.site_file_access(p_path text, p_action text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when private.can_manage_website() and split_part(p_path, '/', 2) in ('post', 'foto') then true
    when private.can_manage_supporters() and split_part(p_path, '/', 2) = 'sponsor' then true
    when p_action = 'delete' then exists (select 1 from public.site_photos ph, unnest(ph.player_ids) pid
                                          where ph.path = p_path and private.can_manage_player(pid))
    when p_action <> 'read' then false
    when private.can_manage_website() then split_part(p_path, '/', 2) in ('post', 'foto', 'sponsor')
    -- în aplicație: doar imaginile știrilor publicate în aplicație pe care utilizatorul le vede (aceleași reguli ca site_posts_select)
    else exists (select 1 from public.site_posts p
                 where p.club_id = private.my_club() and p.status = 'published' and p.to_app
                   and (p.cover_path = p_path or p.blocks @> jsonb_build_array(jsonb_build_object('path', p_path)))
                   and (private.my_role() not in ('guardian', 'player') or p.app_group_ids = '{}'::uuid[]
                        or p.app_group_ids && private.my_family_group_ids()))
  end
$$;

create or replace function private.check_message_audience(p_audience jsonb) returns void
language plpgsql stable security definer set search_path = '' as $$
declare v_role public.app_role := private.my_role(); v_bad int;
begin
  if not private.can_send_messages() then raise exception 'Nu poți trimite mesaje.' using errcode = '42501'; end if;
  if jsonb_array_length(coalesce(p_audience->'audiences', '[]'::jsonb)) = 0 then
    raise exception 'Alege cui trimiți mesajul.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements_text(p_audience->'audiences') a where a not in ('guardians', 'players', 'coaches', 'staff')) then
    raise exception 'Public necunoscut.' using errcode = '22023';
  end if;
  select count(*) into v_bad from jsonb_array_elements_text(coalesce(p_audience->'group_ids', '[]'::jsonb)) x
  where private.group_club(x::uuid) is distinct from private.my_club();
  if v_bad > 0 then raise exception 'Echipă necunoscută.' using errcode = '22023'; end if;
  if v_role in ('coach', 'physio') then
    if p_audience->'audiences' ? 'staff' then raise exception 'Mesajele către tot staff-ul le trimite biroul.' using errcode = '42501'; end if;
    if v_role = 'coach' and (jsonb_array_length(coalesce(p_audience->'group_ids', '[]'::jsonb)) = 0
        or exists (select 1 from jsonb_array_elements_text(p_audience->'group_ids') x where x::uuid <> all (private.my_group_ids()))) then
      raise exception 'Antrenorul trimite mesaje doar echipelor lui.' using errcode = '42501';
    end if;
    -- kinetoterapeutul lucrează cu toate echipele, dar alege explicit cui scrie
    if v_role = 'physio' and jsonb_array_length(coalesce(p_audience->'group_ids', '[]'::jsonb)) = 0 then
      raise exception 'Alege echipele cărora le scrii.' using errcode = '42501';
    end if;
  end if;
end $$;
do $$
declare v_src text;
begin
  select pg_get_functiondef('private.scrub_player_lr(uuid, text)'::regprocedure) into v_src;
  if position('shop_orders' in v_src) = 0 then
    v_src := regexp_replace(v_src, E'\nend;?\\s*\\$[a-z_]*\\$\\s*$',
      E'\n  update public.shop_orders set child_name = ''Jucător șters'' where player_id = p_player;\n'
      || E'  if coalesce(p_name, '''') <> '''' then\n'
      || E'    update public.message_recipients set reason = replace(reason, p_name, ''—'') where reason like ''%'' || p_name || ''%'';\n'
      || E'    delete from public.notifications n where n.kind in (''camp'', ''shop_order'', ''enrolment'', ''news'', ''contract_sign'')\n'
      || E'      and (n.title like ''%'' || p_name || ''%'' or n.body like ''%'' || p_name || ''%'');\n'
      || E'  end if;\nend;\n$function$\n');
    if position('shop_orders' in v_src) = 0 then raise exception 'scrub_player_lr: punctul de inserare nu a fost găsit'; end if;
    execute v_src;
  end if;
end $$;

/** Secțiunea site-ului e pornită (implicit da). */
create or replace function private.site_section_on(p_club uuid, p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select (c.settings->'site'->>p_key)::boolean from public.clubs c where c.id = p_club), true)
$$;

create or replace function public.public_posts(p_slug text, p_limit int default 12, p_offset int default 0)
returns table (id uuid, title text, slug text, excerpt text, cover_path text, published_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.title, p.slug, private.post_excerpt(p.excerpt, p.blocks), p.cover_path, p.published_at from public.site_posts p
  where p.club_id = private.club_by_slug(p_slug) and p.status = 'published' and p.to_site
    and private.site_section_on(p.club_id, 'news')
  order by p.published_at desc limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
$$;
create or replace function public.public_post(p_slug text, p_post text)
returns table (id uuid, title text, slug text, excerpt text, cover_path text, blocks jsonb, published_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.title, p.slug, private.post_excerpt(p.excerpt, p.blocks), p.cover_path, p.blocks, p.published_at from public.site_posts p
  where p.club_id = private.club_by_slug(p_slug) and p.status = 'published' and p.to_site and p.slug = p_post
    and private.site_section_on(p.club_id, 'news')
$$;
create or replace function public.public_teams(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with c as (select id, coalesce(settings->'site', '{}'::jsonb) as s from public.clubs where slug = lower(trim(p_slug)))
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id, 'name', g.name, 'from', g.birth_year_from, 'to', g.birth_year_to,
    'coaches', case when coalesce((c.s->>'show_staff')::boolean, false) then
      coalesce((select jsonb_agg(pr.full_name order by pr.full_name) from public.staff_groups sg join public.profiles pr on pr.id = sg.user_id and pr.is_active and pr.role = 'coach'
                where sg.group_id = g.id), '[]'::jsonb) else '[]'::jsonb end,
    'roster', case when c.s->'roster_groups' ? g.id::text then
      coalesce((select jsonb_agg(jsonb_build_object('name', pl.display_name, 'number', pl.shirt_number, 'position', pl.position) order by pl.shirt_number nulls last, pl.display_name)
                from public.players pl where pl.group_id = g.id and pl.is_active and pl.anonymized_at is null
                  and pl.birth_date is not null and pl.birth_date <= private.club_today(c.id) - interval '18 years'), '[]'::jsonb) else '[]'::jsonb end
  ) order by g.sort), '[]'::jsonb)
  from c join public.groups g on g.club_id = c.id and g.is_active
  where private.site_section_on(c.id, 'teams')
$$;
create or replace function public.public_camps(p_slug text)
returns table (id uuid, title text, description text, location text, starts_on date, ends_on date, price bigint,
               birth_year_from smallint, birth_year_to smallint, deadline date, spots_left int)
language sql stable security definer set search_path = '' as $$
  select c.id, c.title, c.description, c.location, c.starts_on, c.ends_on, c.price, c.birth_year_from, c.birth_year_to, c.deadline,
         greatest(c.capacity - private.camp_taken(c.id), 0)
  from public.camps c
  where c.club_id = private.club_by_slug(p_slug) and c.is_public and c.status = 'open'
    and coalesce(c.deadline, c.starts_on) >= private.club_today(c.club_id)
    and private.site_section_on(c.club_id, 'camps')
  order by c.starts_on
$$;
create or replace function public.site_public_file(p_slug text, p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.site_posts p where p.club_id = private.club_by_slug(p_slug) and p.status = 'published' and p.to_site
                   and private.site_section_on(p.club_id, 'news')
                   and (p.cover_path = p_path or p.blocks @> jsonb_build_array(jsonb_build_object('path', p_path))))
      or exists (select 1 from public.site_photos ph where ph.club_id = private.club_by_slug(p_slug) and ph.path = p_path and private.photo_is_public(ph.id))
      or exists (select 1 from public.sponsors s where s.club_id = private.club_by_slug(p_slug) and s.logo_path = p_path
                   and s.show_on_site and s.status in ('signed', 'paid'))
$$;
create or replace function public.delete_site_post(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_website() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  delete from public.site_posts where id = p_id and club_id = private.my_club();
  if found then delete from public.notifications where dedupe_key = 'news:' || p_id; end if;
end $$;

create or replace function public.enrol_request(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_r record; v_club uuid := private.my_club(); v_group uuid := nullif(p->>'group_id', '')::uuid; v_player uuid; v_guardian uuid;
  v_parts text[]; v_display text; v_today date := private.club_today(); v_period date := date_trunc('month', private.club_today())::date;
  v_fee bigint; v_fs record; v_charges int := 0; v_enrol_fee bigint := coalesce((p->>'enrol_fee')::bigint, 0);
begin
  if not private.can_manage_enrolment() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  select * into v_r from public.enrolment_requests where id = p_id and club_id = v_club for update;
  if not found then raise exception 'Cererea nu a fost găsită.' using errcode = 'P0002'; end if;
  if v_r.status in ('enrolled', 'declined', 'withdrawn') then raise exception 'Cererea e închisă.' using errcode = '22023'; end if;
  if v_group is null or not exists (select 1 from public.groups g where g.id = v_group and g.club_id = v_club and g.is_active) then
    raise exception 'Alege echipa.' using errcode = '22023';
  end if;
  if v_enrol_fee < 0 or v_enrol_fee > 100000000 then raise exception 'Taxa de înscriere nu e validă.' using errcode = '22023'; end if;

  v_parts := regexp_split_to_array(trim(v_r.child_name), '\s+');
  v_display := coalesce(nullif(trim(p->>'display_name'), ''),
    case when array_length(v_parts, 1) >= 2 then upper(v_parts[1]) || ' ' || upper(left(v_parts[2], 1)) || '.' else upper(v_r.child_name) end);
  insert into public.players (club_id, group_id, full_name, display_name, birth_date, position, enrolled_on, is_active, photo_consent)
  values (v_club, v_group, trim(v_r.child_name), left(v_display, 60), v_r.birth_date, v_r.position, v_today, true, false)
  returning id into v_player;

  -- părintele: aceeași adresă de e-mail în club → aceeași fișă (frați); altfel fișă nouă
  -- aceeași adresă de e-mail în club: biroul confirmă că e aceeași familie (oricine poate scrie o adresă în formularul public)
  if v_r.parent_email is not null then
    select g.id into v_guardian from public.guardians g
    where g.club_id = v_club and g.deleted_at is null and lower(g.email) = v_r.parent_email order by g.created_at limit 1;
    if v_guardian is not null and not coalesce((p->>'link_existing')::boolean, false) then
      raise exception 'FAMILIE_EXISTENTA:%', (select full_name from public.guardians where id = v_guardian) using errcode = 'P0001';
    end if;
  end if;
  if v_guardian is null then
    insert into public.guardians (club_id, full_name, email, phone) values (v_club, v_r.parent_name, v_r.parent_email, v_r.parent_phone)
    returning id into v_guardian;
  end if;
  insert into public.guardian_players (guardian_id, player_id, relation, is_billing)
  values (v_guardian, v_player, v_r.relation, true) on conflict (guardian_id, player_id) do update set is_billing = true;

  select * into v_fs from public.finance_settings where club_id = v_club;
  -- (un record e „not null” doar dacă toate câmpurile au valori; se testează FOUND)
  if coalesce((p->>'first_month')::boolean, false) and found then
    v_fee := private.effective_fee(v_player, v_period);
    if coalesce(v_fee, 0) > 0 then
      insert into public.charges (club_id, player_id, guardian_id, kind, period, title, amount, due_on, created_by)
      values (v_club, v_player, v_guardian, 'monthly', v_period, 'Taxă lunară ' || private.month_ro(v_period), v_fee,
              greatest(v_today + 7, make_date(extract(year from v_period)::int, extract(month from v_period)::int, v_fs.due_day)), app_auth.uid())
      on conflict do nothing;
      v_charges := v_charges + 1;
    end if;
  end if;
  if v_enrol_fee > 0 then
    insert into public.charges (club_id, player_id, guardian_id, kind, title, amount, due_on, created_by)
    values (v_club, v_player, v_guardian, 'one_off', 'Taxă de înscriere', v_enrol_fee, v_today + 7, app_auth.uid());
    v_charges := v_charges + 1;
  end if;

  update public.enrolment_requests set status = 'enrolled', player_id = v_player, guardian_id = v_guardian, group_id = v_group, updated_at = now()
  where id = p_id;
  perform private.enrolment_log(p_id, 'enrolled', (select name from public.groups where id = v_group));
  return jsonb_build_object('player_id', v_player, 'guardian_id', v_guardian, 'charges', v_charges);
end $$;
do $$
declare f text;
begin
  foreach f in array array[
    'private.deliver_message(uuid)', 'private.confirm_camp_spot(uuid)', 'private.promote_camp_waitlist(uuid)', 'private.lock_camp(uuid)',
    'private.camp_open_for(uuid, uuid)', 'private.insert_enrolment(uuid, jsonb, text)', 'private.public_hit(uuid, text, text, integer, integer)',
    'private.enrolment_log(uuid, text, text)', 'private.render_contract(text, uuid, text)', 'private.contract_photo_consent()',
    'private.clean_blocks(jsonb, uuid)', 'private.slugify(text)', 'private.post_excerpt(text, jsonb)', 'private.group_for_birth(uuid, date)']
  loop
    if to_regprocedure(f) is null then raise exception 'funcție lipsă: %', f; end if;
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;
