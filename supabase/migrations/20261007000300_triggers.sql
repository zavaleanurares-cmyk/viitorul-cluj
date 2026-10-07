-- =============================================================================
-- 0003 · Triggere: istoric de stare/grupă, jurnal de audit, alerte, notificări
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Utilitare
-- ---------------------------------------------------------------------------
create or replace function private.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger injuries_touch before update on public.injuries
  for each row execute function private.touch_updated_at();
create trigger wellness_touch before update on public.wellness_entries
  for each row execute function private.touch_updated_at();
create trigger player_contacts_touch before update on public.player_contacts
  for each row execute function private.touch_updated_at();

-- Setările clubului, cu valori implicite.
create or replace function private.club_setting(p_club uuid, p_path text[], p_default numeric)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce((select (c.settings #>> p_path)::numeric from public.clubs c where c.id = p_club), p_default)
$$;

create or replace function private.notify(
  p_user uuid, p_kind text, p_title text, p_body text, p_link text, p_dedupe text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  values (p_user, p_kind, p_title, p_body, p_link, p_dedupe)
  on conflict do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- Jucători: istoric de stare și de grupă
-- ---------------------------------------------------------------------------
create or replace function private.players_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status_id is null then
      select s.id into new.status_id from public.club_statuses s
      where s.club_id = new.club_id and s.is_active order by s.sort limit 1;
    end if;
    new.status_updated_at := coalesce(new.status_updated_at, now());
  elsif (new.status_id, new.status_note, new.status_zone, new.status_side, new.status_zone_detail,
         new.status_zone_uncertain, new.status_return_on)
        is distinct from
        (old.status_id, old.status_note, old.status_zone, old.status_side, old.status_zone_detail,
         old.status_zone_uncertain, old.status_return_on) then
    new.status_updated_at := now();
  end if;
  return new;
end $$;

create trigger players_before_write before insert or update on public.players
  for each row execute function private.players_before_write();

create or replace function private.players_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_status record;
  v_user uuid;
  v_today date := private.club_today(new.club_id);
begin
  -- istoric de grupă
  if tg_op = 'INSERT' then
    insert into public.player_group_history (player_id, group_id, from_date)
    values (new.id, new.group_id, v_today);
  elsif new.group_id is distinct from old.group_id then
    update public.player_group_history set to_date = v_today
    where player_id = new.id and to_date is null;
    insert into public.player_group_history (player_id, group_id, from_date)
    values (new.id, new.group_id, v_today);
  end if;

  -- istoric de stare
  if tg_op = 'INSERT' or new.status_updated_at is distinct from old.status_updated_at then
    insert into public.status_history
      (player_id, status_id, note, zone, side, zone_detail, zone_uncertain, return_on, changed_by)
    values
      (new.id, new.status_id, new.status_note, new.status_zone, new.status_side, new.status_zone_detail,
       new.status_zone_uncertain, new.status_return_on, (select auth.uid()));
  end if;

  -- notificări la schimbarea stării
  if tg_op = 'UPDATE' and new.status_id is distinct from old.status_id then
    select s.label into v_status from public.club_statuses s where s.id = new.status_id;
    perform private.notify(
      new.user_id, 'status_changed', 'Starea ta a fost actualizată',
      'Stare nouă: ' || coalesce(v_status.label, '—'), '/azi', null);
    for v_user in
      select sg.user_id from public.staff_groups sg
      join public.profiles p on p.id = sg.user_id and p.is_active and p.role = 'coach'
      where sg.group_id = new.group_id
    loop
      perform private.notify(
        v_user, 'status_changed', new.display_name || ': ' || coalesce(v_status.label, '—'),
        nullif(new.status_note, ''), '/disponibilitate', null);
    end loop;
  end if;
  return null;
end $$;

create trigger players_after_write after insert or update on public.players
  for each row execute function private.players_after_write();

-- ---------------------------------------------------------------------------
-- Jurnal de audit (modificări). Citirile se jurnalizează prin RPC log_medical_access.
-- ---------------------------------------------------------------------------
create or replace function private.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_club uuid;
  v_player uuid;
  v_details jsonb;
  v_key text;
begin
  -- jucătorul vizat
  if tg_table_name = 'players' then
    v_player := (v_row->>'id')::uuid;
  elsif v_row ? 'player_id' then
    v_player := (v_row->>'player_id')::uuid;
  elsif v_row ? 'injury_id' and v_row->>'injury_id' is not null then
    select i.player_id into v_player from public.injuries i where i.id = (v_row->>'injury_id')::uuid;
  elsif v_row ? 'referral_id' then
    select r.player_id into v_player from public.referrals r where r.id = (v_row->>'referral_id')::uuid;
  elsif v_row ? 'plan_id' then
    select dp.player_id into v_player from public.daily_plans dp where dp.id = (v_row->>'plan_id')::uuid;
  end if;

  -- clubul
  if tg_table_name = 'clubs' then
    v_club := (v_row->>'id')::uuid;
  elsif v_row ? 'club_id' then
    v_club := (v_row->>'club_id')::uuid;
  elsif v_player is not null then
    select pl.club_id into v_club from public.players pl where pl.id = v_player;
  elsif v_row ? 'group_id' then
    select g.club_id into v_club from public.groups g where g.id = (v_row->>'group_id')::uuid;
  end if;
  v_club := coalesce(v_club, private.my_club());
  -- la ștergerea în cascadă a unui club nu mai avem ce jurnaliza
  if v_club is not null and not exists (select 1 from public.clubs c where c.id = v_club) then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    -- doar câmpurile schimbate, cu valoarea veche și cea nouă
    v_details := '{}'::jsonb;
    for v_key in select jsonb_object_keys(v_new) loop
      if v_new->v_key is distinct from v_old->v_key
         and v_key not in ('updated_at', 'status_updated_at') then
        v_details := v_details || jsonb_build_object(v_key, jsonb_build_object('old', v_old->v_key, 'new', v_new->v_key));
      end if;
    end loop;
    if v_details = '{}'::jsonb then return null; end if;
  elsif tg_op = 'DELETE' then
    v_details := jsonb_build_object('deleted', v_old - 'raw');
  else
    v_details := null;
  end if;

  insert into public.audit_log (club_id, actor_id, actor_role, action, entity, entity_id, player_id, details)
  values (
    v_club, (select auth.uid()), coalesce((select private.my_role())::text, 'system'), tg_op, tg_table_name,
    coalesce(v_row->>'id', v_row->>'player_id', v_row->>'user_id'),
    case when tg_op = 'DELETE' and tg_table_name = 'players' then null else v_player end,
    v_details
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'clubs','club_statuses','groups','profiles','staff_groups',
    'players','player_contacts','anthropometrics',
    'injuries','injury_treatments','medical_documents','referrals','partner_notes',
    'exercises','programs','program_assignments','daily_plans',
    'wellness_entries','rpe_entries','fitness_test_results',
    'consents','data_requests','imports'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function private.audit()', t || '_audit', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Alerte din chestionar
-- ---------------------------------------------------------------------------
create or replace function private.raise_alert(
  p_player uuid, p_kind text, p_severity text, p_date date, p_message text, p_data jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_club uuid;
  v_name text;
  v_id uuid;
  v_user uuid;
begin
  select pl.club_id, pl.display_name into v_club, v_name from public.players pl where pl.id = p_player;
  insert into public.alerts (club_id, player_id, kind, severity, alert_date, message, data)
  values (v_club, p_player, p_kind, p_severity, p_date, p_message, coalesce(p_data, '{}'::jsonb))
  on conflict (player_id, kind, alert_date)
    do update set message = excluded.message, data = excluded.data, severity = excluded.severity
    where public.alerts.resolved_at is null
  returning id into v_id;

  if v_id is not null then
    for v_user in
      select p.id from public.profiles p where p.club_id = v_club and p.role = 'physio' and p.is_active
    loop
      perform private.notify(v_user, 'alert', v_name || ': ' || p_message, null,
        '/jucatori/' || p_player::text, 'alert:' || p_player::text || ':' || p_kind || ':' || p_date::text);
    end loop;
  end if;
end $$;

create or replace function private.wellness_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_club uuid;
  v_fatigue_thr numeric;
  v_muscle_thr numeric;
  v_spike numeric;
  v_pain_thr numeric;
  v_avg numeric;
  v_n int;
begin
  -- importurile istorice nu generează alerte
  if new.source = 'import' then return null; end if;

  select pl.club_id into v_club from public.players pl where pl.id = new.player_id;
  v_fatigue_thr := private.club_setting(v_club, '{alerts,fatigue_threshold}', 8);
  v_muscle_thr  := private.club_setting(v_club, '{alerts,muscle_load_threshold}', 8);
  v_spike       := private.club_setting(v_club, '{alerts,spike_delta}', 3);
  v_pain_thr    := private.club_setting(v_club, '{alerts,pain_intensity_threshold}', 1);

  if new.fatigue is not null and new.fatigue >= v_fatigue_thr then
    perform private.raise_alert(new.player_id, 'fatigue_high',
      case when new.fatigue >= 9 then 'critical' else 'warning' end, new.entry_date,
      'Oboseală ' || new.fatigue || '/10', jsonb_build_object('fatigue', new.fatigue));
  else
    delete from public.alerts a where a.player_id = new.player_id and a.kind = 'fatigue_high'
      and a.alert_date = new.entry_date and a.resolved_at is null;
  end if;

  if new.muscle_load is not null and new.muscle_load >= v_muscle_thr then
    perform private.raise_alert(new.player_id, 'muscle_load_high',
      case when new.muscle_load >= 9 then 'critical' else 'warning' end, new.entry_date,
      'Încărcătură musculară ' || new.muscle_load || '/10', jsonb_build_object('muscle_load', new.muscle_load));
  else
    delete from public.alerts a where a.player_id = new.player_id and a.kind = 'muscle_load_high'
      and a.alert_date = new.entry_date and a.resolved_at is null;
  end if;

  -- creștere bruscă față de media personală din ultimele 28 de zile (minimum 5 completări)
  if new.fatigue is not null then
    select avg(w.fatigue), count(*) into v_avg, v_n
    from public.wellness_entries w
    where w.player_id = new.player_id and w.fatigue is not null
      and w.entry_date < new.entry_date and w.entry_date >= new.entry_date - 28;
    if v_n >= 5 and new.fatigue - v_avg >= v_spike then
      perform private.raise_alert(new.player_id, 'fatigue_spike', 'warning', new.entry_date,
        'Oboseală ' || new.fatigue || '/10, față de media personală ' || round(v_avg, 1),
        jsonb_build_object('fatigue', new.fatigue, 'average', round(v_avg, 1)));
    else
      delete from public.alerts a where a.player_id = new.player_id and a.kind = 'fatigue_spike'
        and a.alert_date = new.entry_date and a.resolved_at is null;
    end if;
  end if;

  if (new.pain_zone is not null or nullif(new.pain_note, '') is not null)
     and coalesce(new.pain_intensity, 10) >= v_pain_thr then
    perform private.raise_alert(new.player_id, 'pain_reported',
      case when coalesce(new.pain_intensity, 0) >= 7 then 'critical' else 'warning' end, new.entry_date,
      'Durere raportată' || coalesce(' (' || new.pain_intensity || '/10)', ''),
      jsonb_build_object('zone', new.pain_zone, 'side', new.pain_side,
                         'intensity', new.pain_intensity, 'note', new.pain_note));
  else
    delete from public.alerts a where a.player_id = new.player_id and a.kind = 'pain_reported'
      and a.alert_date = new.entry_date and a.resolved_at is null;
  end if;
  return null;
end $$;

create trigger wellness_after_write after insert or update on public.wellness_entries
  for each row execute function private.wellness_after_write();

-- Durere semnalată la bifarea unui exercițiu
create or replace function private.completion_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.pain then
    perform private.raise_alert(new.player_id, 'exercise_pain',
      case when coalesce(new.pain_intensity, 0) >= 7 then 'critical' else 'warning' end, new.done_on,
      'Durere semnalată la exerciții' || coalesce(' (' || new.pain_intensity || '/10)', ''),
      jsonb_build_object('comment', new.comment, 'intensity', new.pain_intensity));
  end if;
  return null;
end $$;

create trigger completion_after_write after insert or update on public.exercise_completions
  for each row execute function private.completion_after_write();

-- ---------------------------------------------------------------------------
-- Notificări: plan nou, program nou
-- ---------------------------------------------------------------------------
create or replace function private.daily_plan_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  select pl.user_id into v_user from public.players pl where pl.id = new.player_id;
  perform private.notify(v_user, 'plan_new',
    'Plan nou pentru ' || to_char(new.plan_date, 'DD.MM.YYYY'),
    nullif(new.title, ''), '/plan?zi=' || new.plan_date::text,
    'plan:' || new.player_id::text || ':' || new.plan_date::text);
  return null;
end $$;

create trigger daily_plan_after_insert after insert on public.daily_plans
  for each row execute function private.daily_plan_after_insert();

create or replace function private.pap_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_name text;
begin
  select pl.user_id into v_user from public.players pl where pl.id = new.player_id;
  select pr.name into v_name from public.program_assignments a
    join public.programs pr on pr.id = a.program_id where a.id = new.assignment_id;
  perform private.notify(v_user, 'program_new', 'Program nou: ' || coalesce(v_name, ''),
    null, '/azi', 'program:' || new.assignment_id::text || ':' || new.player_id::text);
  return null;
end $$;

create trigger pap_after_insert after insert on public.program_assignment_players
  for each row execute function private.pap_after_insert();

revoke execute on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;
