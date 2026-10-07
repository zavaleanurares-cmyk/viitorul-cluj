-- =============================================================================
-- 1300 · Administrare: starea conturilor, evenimente de audit, ștergere reală
--
-- 1. `admin_accounts()` — preparatorul vede, pentru conturile clubului lui, dacă parola
--    a fost aleasă, dacă contul e dezactivat și ultima autentificare. Tabelele din
--    `app_auth` rămân inaccesibile rolurilor aplicației; funcția întoarce doar aceste câmpuri.
-- 2. `log_event` acceptă și INVITE / RESET / ANONYMIZE / ERASE (invitații, linkuri de
--    resetare, anonimizări, ștergeri definitive).
-- 3. Anonimizarea și ștergerea definitivă nu lăsau jurnalul de audit curat: triggerul de
--    audit păstra valorile vechi (nume, diagnostice, date de contact) în `details`.
--    `private.scrub_player_traces` înlocuiește acele valori cu lista câmpurilor atinse.
--    `anonymize_player` este completată, iar `erase_player` face ștergerea definitivă.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Starea conturilor clubului (doar preparator)
-- ---------------------------------------------------------------------------
create or replace function public.admin_accounts()
returns table (
  user_id uuid,
  has_password boolean,
  disabled boolean,
  anonymized boolean,
  last_sign_in_at timestamptz,
  invite_expires_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare v_club uuid := private.my_club();
begin
  if not private.is_physio() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  return query
    select p.id,
           u.password_hash is not null,
           u.disabled_at is not null,
           u.email like 'anonimizat-%@anonim.invalid',
           u.last_sign_in_at,
           (select max(t.expires_at) from app_auth.tokens t
             where t.user_id = u.id and t.used_at is null and t.expires_at > now())
    from public.profiles p
    join app_auth.users u on u.id = p.id
    where p.club_id = v_club;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Evenimente de audit scrise de aplicație
--    `p_details` poate purta `entity_id` (ex. id-ul contului) și `player_id`.
-- ---------------------------------------------------------------------------
create or replace function public.log_event(p_action text, p_entity text, p_details jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select app_auth.uid()) is null then return; end if;
  if p_action not in ('LOGIN', 'EXPORT', 'DOWNLOAD', 'CONSENT') then
    -- acțiunile de administrare sunt doar ale preparatorului
    if p_action not in ('INVITE', 'RESET', 'ANONYMIZE', 'ERASE') or not private.is_physio() then
      raise exception 'Acțiune necunoscută';
    end if;
  end if;
  insert into public.audit_log (club_id, actor_id, actor_role, action, entity, entity_id, player_id, details)
  values ((select private.my_club()), (select app_auth.uid()), (select private.my_role())::text,
          p_action, left(p_entity, 80),
          left(p_details->>'entity_id', 80),
          case when p_details ? 'player_id' then private.try_uuid(p_details->>'player_id') end,
          nullif(p_details - 'entity_id', '{}'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- 3. Urmele unui jucător în jurnal, notificări și alerte
-- ---------------------------------------------------------------------------
create or replace function private.redact_details(p_details jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case
    when p_details is null then null
    when p_details ? 'redacted' then p_details
    else jsonb_build_object(
      'redacted', true,
      'fields', coalesce((select jsonb_agg(k order by k) from jsonb_object_keys(p_details - 'deleted') k), '[]'::jsonb))
  end
$$;

create or replace function private.scrub_player_traces(p_player uuid, p_user uuid, p_club uuid, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- jurnalul de audit păstrează faptul (cine, ce, când), nu și valorile
  update public.audit_log a set details = private.redact_details(a.details)
  where a.details is not null and not (a.details ? 'redacted')
    and (a.player_id = p_player
         or (a.entity = 'players' and a.entity_id = p_player::text)
         or (p_user is not null and a.entity = 'profiles' and a.entity_id = p_user::text)
         or (p_user is not null and a.entity = 'consents' and a.details->'deleted'->>'user_id' = p_user::text));

  -- notificările staffului care poartă numele jucătorului
  delete from public.notifications n
  where n.link like '/jucatori/' || p_player::text || '%'
     or (coalesce(p_name, '') <> '' and n.kind = 'status_changed' and n.title like p_name || ': %'
         and n.user_id in (select p.id from public.profiles p where p.club_id = p_club));
end $$;

revoke execute on function private.redact_details(jsonb) from public;
revoke execute on function private.scrub_player_traces(uuid, uuid, uuid, text) from public;
grant execute on function private.redact_details(jsonb) to service_role;
grant execute on function private.scrub_player_traces(uuid, uuid, uuid, text) to service_role;

-- Anonimizare: păstrează datele statistice, elimină tot ce identifică persoana.
-- Fișierele din depozit se șterg de aplicație înainte de apel; contul din `app_auth` îl
-- dezactivează aplicația imediat după.
create or replace function public.anonymize_player(p_player uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_club uuid;
  v_name text;
begin
  if not private.can_manage_player(p_player) then raise exception 'Acces interzis' using errcode = '42501'; end if;
  select pl.user_id, pl.club_id, pl.display_name into v_user, v_club, v_name from public.players pl where pl.id = p_player;
  delete from public.player_contacts where player_id = p_player;
  delete from public.medical_documents where player_id = p_player;
  delete from public.partner_notes where referral_id in (select r.id from public.referrals r where r.player_id = p_player);
  delete from public.referrals where player_id = p_player;
  delete from public.name_matches where player_id = p_player;
  delete from public.consents where player_id = p_player;
  update public.injuries set diagnosis = null, notes = null, zone_detail = null where player_id = p_player;
  delete from public.injury_treatments where injury_id in (select i.id from public.injuries i where i.player_id = p_player);
  update public.wellness_entries set pain_note = null, raw = null, review_note = null where player_id = p_player;
  update public.exercise_completions set comment = null where player_id = p_player;
  update public.status_history set note = null, zone_detail = null where player_id = p_player;
  update public.daily_plans set notes = null, title = null where player_id = p_player;
  update public.anthropometrics set notes = null where player_id = p_player;
  update public.fitness_test_results set notes = null where player_id = p_player;
  update public.alerts set data = data - 'note' - 'comment' where player_id = p_player;
  update public.players set
    full_name = 'Jucător anonimizat', display_name = 'Anonimizat ' || left(p_player::text, 4),
    birth_date = case when birth_date is null then null else make_date(extract(year from birth_date)::int, 1, 1) end,
    shirt_number = null, photo_path = null, user_id = null, status_note = null, status_zone_detail = null,
    training_restrictions = null, review_note = null, needs_review = false,
    is_active = false, anonymized_at = now()
  where id = p_player;
  if v_user is not null then
    delete from public.consents where user_id = v_user;
    delete from public.notifications where user_id = v_user;
    delete from public.push_tokens where user_id = v_user;
    update public.profiles set is_active = false, full_name = 'Cont anonimizat', email = null, phone = null where id = v_user;
  end if;
  perform private.scrub_player_traces(p_player, v_user, v_club, v_name);
  insert into public.audit_log (club_id, actor_id, actor_role, action, entity, entity_id, player_id)
  values (v_club, (select app_auth.uid()), (select private.my_role())::text, 'ANONYMIZE', 'players', p_player::text, p_player);
end $$;

-- Ștergere definitivă: rândul jucătorului și tot ce ține de el (cascadă), plus profilul contului
-- legat. Întoarce id-ul acelui cont (dacă exista), pe care aplicația îl șterge apoi din `app_auth`.
create or replace function public.erase_player(p_player uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_club uuid;
  v_name text;
begin
  if not private.can_manage_player(p_player) then raise exception 'Acces interzis' using errcode = '42501'; end if;
  select pl.user_id, pl.club_id, pl.display_name into v_user, v_club, v_name from public.players pl where pl.id = p_player;
  -- întâi rândurile legate indirect, cât timp jurnalul le mai poate atribui jucătorului
  delete from public.injury_treatments where injury_id in (select i.id from public.injuries i where i.player_id = p_player);
  delete from public.partner_notes where referral_id in (select r.id from public.referrals r where r.player_id = p_player);
  delete from public.players where id = p_player;
  if v_user is not null then
    -- profilul se șterge aici (nu prin cascada din `app_auth`), ca urma lui din jurnal să fie curățată mai jos
    delete from public.profiles where id = v_user and club_id = v_club;
  end if;
  perform private.scrub_player_traces(p_player, v_user, v_club, v_name);
  -- rândurile șterse în cascadă nu mai au jucătorul în jurnal: le curățăm după conținut
  update public.audit_log a set details = private.redact_details(a.details)
  where a.club_id = v_club and a.action = 'DELETE' and a.details is not null and not (a.details ? 'redacted')
    and a.details->'deleted'->>'player_id' = p_player::text;
  insert into public.audit_log (club_id, actor_id, actor_role, action, entity, entity_id)
  values (v_club, (select app_auth.uid()), (select private.my_role())::text, 'ERASE', 'players', p_player::text);
  return v_user;
end $$;

revoke execute on function public.admin_accounts() from public, anon;
revoke execute on function public.erase_player(uuid) from public, anon;
grant execute on function public.admin_accounts() to authenticated, service_role;
grant execute on function public.erase_player(uuid) to authenticated, service_role;
