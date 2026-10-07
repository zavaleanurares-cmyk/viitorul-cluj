-- =============================================================================
-- 0004 · Funcții apelabile prin API (RPC)
-- Cele SECURITY INVOKER rulează sub RLS-ul apelantului; cele SECURITY DEFINER
-- își verifică singure apelantul și întorc doar ce are voie să vadă.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Cont propriu
-- ---------------------------------------------------------------------------
create or replace function public.update_my_profile(
  p_full_name text default null,
  p_phone text default null,
  p_email_notifications boolean default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select app_auth.uid()) is null then raise exception 'Neautentificat' using errcode = '42501'; end if;
  update public.profiles set
    full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
    phone = case when p_phone is null then phone else nullif(trim(p_phone), '') end,
    email_notifications = coalesce(p_email_notifications, email_notifications)
  where id = (select app_auth.uid());
end $$;

create or replace function public.clear_must_change_password()
returns void language sql security definer set search_path = '' as $$
  update public.profiles set must_change_password = false where id = (select app_auth.uid());
$$;

-- Jucătorul își poate schimba doar fotografia și numele de afișare? Nu: doar fotografia.
create or replace function public.set_my_photo(p_path text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_player uuid;
begin
  select pl.id into v_player from public.players pl where pl.user_id = (select app_auth.uid());
  if v_player is null then raise exception 'Fără fișă de jucător' using errcode = '42501'; end if;
  if p_path is not null and p_path not like v_player::text || '/%' then
    raise exception 'Cale nepermisă' using errcode = '42501';
  end if;
  update public.players set photo_path = p_path where id = v_player;
end $$;

-- ---------------------------------------------------------------------------
-- Audit: citirea fișei medicale
-- ---------------------------------------------------------------------------
create or replace function public.log_medical_access(p_player uuid, p_section text default 'fisa')
returns void language plpgsql security definer set search_path = '' as $$
declare v_club uuid;
begin
  if not (private.can_read_player_summary(p_player) or private.partner_can_read_player(p_player)) then
    raise exception 'Acces interzis' using errcode = '42501';
  end if;
  -- jucătorul care își citește propria fișă nu se jurnalizează
  if private.is_self(p_player) then return; end if;
  select pl.club_id into v_club from public.players pl where pl.id = p_player;
  -- o singură intrare la 5 minute pentru același cititor / jucător / secțiune
  if exists (
    select 1 from public.audit_log a
    where a.actor_id = (select app_auth.uid()) and a.player_id = p_player
      and a.action = 'READ' and a.entity = p_section
      and a.created_at > now() - interval '5 minutes'
  ) then return; end if;
  insert into public.audit_log (club_id, actor_id, actor_role, action, entity, entity_id, player_id)
  values (v_club, (select app_auth.uid()), (select private.my_role())::text, 'READ', p_section, p_player::text, p_player);
end $$;

create or replace function public.log_event(p_action text, p_entity text, p_details jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select app_auth.uid()) is null then return; end if;
  if p_action not in ('LOGIN', 'EXPORT', 'DOWNLOAD', 'CONSENT') then
    raise exception 'Acțiune necunoscută';
  end if;
  insert into public.audit_log (club_id, actor_id, actor_role, action, entity, player_id, details)
  values ((select private.my_club()), (select app_auth.uid()), (select private.my_role())::text,
          p_action, left(p_entity, 80),
          case when p_details ? 'player_id' then (p_details->>'player_id')::uuid end, p_details);
end $$;

-- ---------------------------------------------------------------------------
-- Privire de ansamblu (patron / director sportiv / preparator; antrenor: grupele lui)
-- Întoarce doar agregate — fără nume, fără diagnostice.
-- ---------------------------------------------------------------------------
create or replace function public.club_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_role public.app_role := (select private.my_role());
  v_club uuid := (select private.my_club());
  v_today date;
  v_season date;
  v_groups uuid[];
  v_result jsonb;
begin
  if v_role is null or v_role not in ('owner', 'sporting_director', 'physio', 'coach') then
    raise exception 'Acces interzis' using errcode = '42501';
  end if;
  v_today := private.club_today(v_club);
  select coalesce((c.settings->>'season_start')::date,
                  make_date(extract(year from v_today)::int - (case when extract(month from v_today) < 7 then 1 else 0 end), 7, 1))
    into v_season from public.clubs c where c.id = v_club;

  if v_role = 'coach' then
    v_groups := private.my_group_ids();
  else
    select coalesce(array_agg(g.id), '{}') into v_groups from public.groups g where g.club_id = v_club and g.is_active;
  end if;

  with pl as (
    select p.*, s.code as status_code, s.availability
    from public.players p
    left join public.club_statuses s on s.id = p.status_id
    where p.club_id = v_club and p.is_active and p.group_id = any (v_groups)
  ),
  inj as (
    select i.*, p.group_id,
           greatest(0, coalesce(i.actual_return_on, v_today) - greatest(i.occurred_on, v_season)) as days_lost
    from public.injuries i
    join public.players p on p.id = i.player_id
    where p.club_id = v_club and p.group_id = any (v_groups)
      and coalesce(i.actual_return_on, v_today) >= v_season
  ),
  grp as (
    select g.id, g.name, g.sort,
      (select count(*) from pl where pl.group_id = g.id) as total,
      (select count(*) from pl where pl.group_id = g.id and pl.availability = 'full') as available,
      (select count(*) from pl where pl.group_id = g.id and pl.availability = 'limited') as limited,
      (select count(*) from pl where pl.group_id = g.id and pl.availability = 'out') as out,
      (select coalesce(jsonb_object_agg(x.status_code, x.n), '{}'::jsonb)
         from (select pl.status_code, count(*) n from pl
               where pl.group_id = g.id and pl.status_code is not null group by 1) x) as statuses,
      (select count(*) from inj where inj.group_id = g.id and inj.actual_return_on is null) as active_injuries,
      (select coalesce(sum(inj.days_lost), 0) from inj where inj.group_id = g.id) as days_lost
    from public.groups g
    where g.id = any (v_groups)
  ),
  weeks as (
    select generate_series(v_today - 77, v_today, interval '7 days')::date as d
  ),
  trend as (
    select w.d,
      count(*) filter (where s.availability = 'full') as available,
      count(*) filter (where s.availability = 'limited') as limited,
      count(*) filter (where s.availability = 'out') as out,
      count(*) as total
    from weeks w
    join public.players p on p.club_id = v_club and p.is_active and p.group_id = any (v_groups)
    join lateral (
      select sh.status_id from public.status_history sh
      where sh.player_id = p.id and sh.created_at < (w.d + 1)::timestamptz
      order by sh.created_at desc limit 1
    ) h on true
    join public.club_statuses s on s.id = h.status_id
    group by w.d
  )
  select jsonb_build_object(
    'generated_at', now(),
    'today', v_today,
    'season_start', v_season,
    'statuses', (select coalesce(jsonb_agg(jsonb_build_object(
                    'code', s.code, 'label', s.label, 'short_label', s.short_label, 'tone', s.tone,
                    'icon', s.icon, 'availability', s.availability) order by s.sort), '[]'::jsonb)
                 from public.club_statuses s where s.club_id = v_club and s.is_active),
    'groups', (select coalesce(jsonb_agg(to_jsonb(grp) - 'sort' order by grp.sort, grp.name), '[]'::jsonb) from grp),
    'totals', jsonb_build_object(
      'players', (select count(*) from pl),
      'available', (select count(*) from pl where availability = 'full'),
      'limited', (select count(*) from pl where availability = 'limited'),
      'out', (select count(*) from pl where availability = 'out'),
      'active_injuries', (select count(*) from inj where actual_return_on is null),
      'injuries_season', (select count(*) from inj where occurred_on >= v_season),
      'recurrences_season', (select count(*) from inj where occurred_on >= v_season and recurrence_of is not null),
      'days_lost_season', (select coalesce(sum(days_lost), 0) from inj)
    ),
    'injuries_by_zone', (select coalesce(jsonb_agg(jsonb_build_object('zone', z.zone, 'count', z.n) order by z.n desc), '[]'::jsonb)
                         from (select coalesce(inj.zone, 'unknown') as zone, count(*) n from inj
                               where inj.occurred_on >= v_season group by 1) z),
    'injuries_by_month', (select coalesce(jsonb_agg(jsonb_build_object('month', m.month, 'count', m.n) order by m.month), '[]'::jsonb)
                          from (select to_char(inj.occurred_on, 'YYYY-MM') as month, count(*) n from inj
                                where inj.occurred_on >= v_season group by 1) m),
    'trend', (select coalesce(jsonb_agg(jsonb_build_object(
                 'date', t.d, 'available', t.available, 'limited', t.limited, 'out', t.out, 'total', t.total) order by t.d), '[]'::jsonb)
              from trend t)
  ) into v_result;
  return v_result;
end $$;

-- Media grupei la testele fizice (ultimul rezultat al fiecărui jucător).
create or replace function public.group_test_averages(p_group uuid)
returns table (test_id uuid, average numeric, best numeric, players int)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_role public.app_role := (select private.my_role());
  v_club uuid := (select private.my_club());
begin
  if private.group_club(p_group) is distinct from v_club then
    raise exception 'Acces interzis' using errcode = '42501';
  end if;
  if not (
    v_role = 'physio'
    or (v_role = 'coach' and p_group = any (private.my_group_ids()))
    or exists (select 1 from public.players pl where pl.user_id = (select app_auth.uid()) and pl.group_id = p_group)
  ) then
    raise exception 'Acces interzis' using errcode = '42501';
  end if;
  return query
    with last as (
      select distinct on (r.test_id, r.player_id) r.test_id, r.value
      from public.fitness_test_results r
      join public.players pl on pl.id = r.player_id
      where pl.group_id = p_group and pl.is_active
      order by r.test_id, r.player_id, r.tested_on desc
    )
    select l.test_id, round(avg(l.value), 2),
           case when t.lower_is_better then min(l.value) else max(l.value) end,
           count(*)::int
    from last l join public.fitness_tests t on t.id = l.test_id
    group by l.test_id, t.lower_is_better
    having count(*) >= 3;   -- sub 3 jucători media ar dezvălui valori individuale
end $$;

-- ---------------------------------------------------------------------------
-- Programe și planuri (SECURITY INVOKER: RLS-ul preparatorului se aplică)
-- ---------------------------------------------------------------------------
create or replace function public.save_program(
  p_id uuid, p_name text, p_description text, p_kind text, p_is_template boolean, p_items jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := p_id;
  v_item jsonb;
  v_keep uuid[] := '{}';
  v_item_id uuid;
  v_sort int := 0;
begin
  if not private.is_physio() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  if v_id is null then
    insert into public.programs (club_id, name, description, kind, is_template, created_by)
    values (private.my_club(), p_name, p_description, coalesce(p_kind, 'prevention'), coalesce(p_is_template, false), (select app_auth.uid()))
    returning id into v_id;
  else
    update public.programs set name = p_name, description = p_description,
      kind = coalesce(p_kind, kind), is_template = coalesce(p_is_template, is_template)
    where id = v_id;
    if not found then raise exception 'Program inexistent'; end if;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_sort := v_sort + 1;
    v_item_id := nullif(v_item->>'id', '')::uuid;
    if v_item_id is not null and exists (select 1 from public.program_exercises pe where pe.id = v_item_id and pe.program_id = v_id) then
      update public.program_exercises set
        exercise_id = (v_item->>'exercise_id')::uuid, sort = v_sort,
        sets = nullif(v_item->>'sets', '')::smallint, reps = nullif(v_item->>'reps', ''),
        duration_sec = nullif(v_item->>'duration_sec', '')::int, rest_sec = nullif(v_item->>'rest_sec', '')::int,
        tempo = nullif(v_item->>'tempo', ''), notes = nullif(v_item->>'notes', '')
      where id = v_item_id;
    else
      insert into public.program_exercises (program_id, exercise_id, sort, sets, reps, duration_sec, rest_sec, tempo, notes)
      values (v_id, (v_item->>'exercise_id')::uuid, v_sort,
        nullif(v_item->>'sets', '')::smallint, nullif(v_item->>'reps', ''),
        nullif(v_item->>'duration_sec', '')::int, nullif(v_item->>'rest_sec', '')::int,
        nullif(v_item->>'tempo', ''), nullif(v_item->>'notes', ''))
      returning id into v_item_id;
    end if;
    v_keep := v_keep || v_item_id;
  end loop;
  delete from public.program_exercises where program_id = v_id and not (id = any (v_keep));
  return v_id;
end $$;

create or replace function public.assign_program(
  p_program uuid, p_target_type text, p_group uuid, p_position text, p_player_ids uuid[],
  p_start date, p_end date, p_weekdays smallint[], p_notes text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
  v_club uuid := private.my_club();
begin
  if not private.is_physio() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  insert into public.program_assignments
    (club_id, program_id, target_type, group_id, position, start_date, end_date, weekdays, notes, created_by)
  values (v_club, p_program, p_target_type,
          case when p_target_type in ('group', 'position') then p_group end,
          case when p_target_type = 'position' then p_position end,
          coalesce(p_start, private.club_today()), p_end,
          coalesce(p_weekdays, '{1,3,5}'), nullif(p_notes, ''), (select app_auth.uid()))
  returning id into v_id;

  insert into public.program_assignment_players (assignment_id, player_id)
  select v_id, pl.id from public.players pl
  where pl.club_id = v_club and pl.is_active
    and case p_target_type
          when 'group' then pl.group_id = p_group
          when 'position' then pl.position = p_position and (p_group is null or pl.group_id = p_group)
          else pl.id = any (coalesce(p_player_ids, '{}'))
        end;
  if not found then raise exception 'Alocarea nu conține niciun jucător'; end if;
  return v_id;
end $$;

-- Salvează planul unei zile (creează sau înlocuiește), păstrând bifele itemilor rămași.
create or replace function public.save_daily_plan(
  p_player uuid, p_date date, p_title text, p_notes text, p_injury uuid, p_rtp_stage smallint, p_items jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
  v_item jsonb;
  v_keep uuid[] := '{}';
  v_item_id uuid;
  v_sort int := 0;
begin
  if not private.can_manage_player(p_player) then raise exception 'Acces interzis' using errcode = '42501'; end if;
  insert into public.daily_plans (player_id, plan_date, title, notes, injury_id, rtp_stage, created_by)
  values (p_player, p_date, nullif(p_title, ''), nullif(p_notes, ''), p_injury, p_rtp_stage, (select app_auth.uid()))
  on conflict (player_id, plan_date) do update
    set title = excluded.title, notes = excluded.notes, injury_id = excluded.injury_id, rtp_stage = excluded.rtp_stage
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_sort := v_sort + 1;
    v_item_id := nullif(v_item->>'id', '')::uuid;
    if v_item_id is not null and exists (select 1 from public.daily_plan_items i where i.id = v_item_id and i.plan_id = v_id) then
      update public.daily_plan_items set
        exercise_id = (v_item->>'exercise_id')::uuid, sort = v_sort,
        sets = nullif(v_item->>'sets', '')::smallint, reps = nullif(v_item->>'reps', ''),
        duration_sec = nullif(v_item->>'duration_sec', '')::int, rest_sec = nullif(v_item->>'rest_sec', '')::int,
        tempo = nullif(v_item->>'tempo', ''), notes = nullif(v_item->>'notes', '')
      where id = v_item_id;
    else
      insert into public.daily_plan_items (plan_id, exercise_id, sort, sets, reps, duration_sec, rest_sec, tempo, notes)
      values (v_id, (v_item->>'exercise_id')::uuid, v_sort,
        nullif(v_item->>'sets', '')::smallint, nullif(v_item->>'reps', ''),
        nullif(v_item->>'duration_sec', '')::int, nullif(v_item->>'rest_sec', '')::int,
        nullif(v_item->>'tempo', ''), nullif(v_item->>'notes', ''))
      returning id into v_item_id;
    end if;
    v_keep := v_keep || v_item_id;
  end loop;
  delete from public.daily_plan_items where plan_id = v_id and not (id = any (v_keep));
  return v_id;
end $$;

-- Copiază un plan pe alte zile și/sau la alți jucători. Planurile existente în țintă sunt înlocuite.
create or replace function public.copy_daily_plan(p_plan uuid, p_dates date[], p_players uuid[] default null)
returns int language plpgsql security invoker set search_path = '' as $$
declare
  v_src record;
  v_player uuid;
  v_date date;
  v_new uuid;
  v_count int := 0;
begin
  select * into v_src from public.daily_plans where id = p_plan;
  if v_src is null or not private.can_manage_player(v_src.player_id) then
    raise exception 'Acces interzis' using errcode = '42501';
  end if;
  foreach v_player in array coalesce(p_players, array[v_src.player_id]) loop
    if not private.can_manage_player(v_player) then raise exception 'Acces interzis' using errcode = '42501'; end if;
    foreach v_date in array p_dates loop
      continue when v_player = v_src.player_id and v_date = v_src.plan_date;
      delete from public.daily_plans where player_id = v_player and plan_date = v_date;
      insert into public.daily_plans (player_id, plan_date, title, notes, injury_id, rtp_stage, created_by)
      values (v_player, v_date, v_src.title, v_src.notes,
              case when v_player = v_src.player_id then v_src.injury_id end,
              case when v_player = v_src.player_id then v_src.rtp_stage end, (select app_auth.uid()))
      returning id into v_new;
      insert into public.daily_plan_items (plan_id, exercise_id, sort, sets, reps, duration_sec, rest_sec, tempo, notes)
      select v_new, i.exercise_id, i.sort, i.sets, i.reps, i.duration_sec, i.rest_sec, i.tempo, i.notes
      from public.daily_plan_items i where i.plan_id = p_plan;
      v_count := v_count + 1;
    end loop;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- Importuri (atomice, idempotente; SECURITY INVOKER)
-- ---------------------------------------------------------------------------
create or replace function private.remember_matches(p_club uuid, p_matches jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare m jsonb;
begin
  for m in select * from jsonb_array_elements(coalesce(p_matches, '[]'::jsonb)) loop
    continue when nullif(m->>'source_name', '') is null or nullif(m->>'player_id', '') is null;
    delete from public.name_matches nm
      where nm.club_id = p_club and nm.source_name = m->>'source_name'
        and nm.group_id is not distinct from nullif(m->>'group_id', '')::uuid;
    insert into public.name_matches (club_id, source_name, group_id, player_id, created_by)
    values (p_club, m->>'source_name', nullif(m->>'group_id', '')::uuid, (m->>'player_id')::uuid, (select app_auth.uid()));
  end loop;
end $$;

-- Stare de sănătate: creează sau actualizează jucători.
create or replace function public.import_health_status(p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_club uuid := private.my_club();
  r jsonb;
  v_player uuid;
  v_status uuid;
  v_created int := 0; v_updated int := 0; v_skipped int := 0; v_flagged int := 0;
  v_matches jsonb := '[]'::jsonb;
  v_import uuid;
  v_details jsonb := '[]'::jsonb;
begin
  if not private.is_physio() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  for r in select * from jsonb_array_elements(coalesce(p_payload->'rows', '[]'::jsonb)) loop
    if coalesce(r->>'action', 'skip') = 'skip' then
      v_skipped := v_skipped + 1;
      v_details := v_details || jsonb_build_object('row', r->'row', 'name', r->>'source_name', 'result', 'skipped', 'note', r->>'review_note');
      continue;
    end if;
    select s.id into v_status from public.club_statuses s where s.club_id = v_club and s.code = r->>'status_code';
    if r->>'action' = 'create' then
      insert into public.players
        (club_id, group_id, full_name, display_name, status_id, status_note, status_zone, status_side,
         status_zone_detail, status_zone_uncertain, status_return_on, needs_review, review_note)
      values
        (v_club, (r->>'group_id')::uuid, coalesce(nullif(r->>'full_name', ''), r->>'display_name'), r->>'display_name',
         v_status, nullif(r->>'status_note', ''), nullif(r->>'zone', ''), nullif(r->>'side', ''),
         nullif(r->>'zone_detail', ''), coalesce((r->>'zone_uncertain')::boolean, false),
         nullif(r->>'return_on', '')::date, coalesce((r->>'needs_review')::boolean, false), nullif(r->>'review_note', ''))
      returning id into v_player;
      v_created := v_created + 1;
    else
      v_player := (r->>'player_id')::uuid;
      update public.players set
        status_id = v_status, status_note = nullif(r->>'status_note', ''),
        status_zone = nullif(r->>'zone', ''), status_side = nullif(r->>'side', ''),
        status_zone_detail = nullif(r->>'zone_detail', ''),
        status_zone_uncertain = coalesce((r->>'zone_uncertain')::boolean, false),
        status_return_on = nullif(r->>'return_on', '')::date,
        needs_review = coalesce((r->>'needs_review')::boolean, false),
        review_note = nullif(r->>'review_note', '')
      where id = v_player;
      if not found then raise exception 'Jucător inexistent: %', r->>'source_name'; end if;
      v_updated := v_updated + 1;
    end if;
    if coalesce((r->>'needs_review')::boolean, false) then v_flagged := v_flagged + 1; end if;
    v_matches := v_matches || jsonb_build_object('source_name', r->>'match_key', 'group_id', r->>'group_id', 'player_id', v_player);
    v_details := v_details || jsonb_build_object('row', r->'row', 'name', r->>'source_name',
      'result', case when r->>'action' = 'create' then 'created' else 'updated' end,
      'flagged', coalesce((r->>'needs_review')::boolean, false), 'note', r->>'review_note');
  end loop;
  perform private.remember_matches(v_club, v_matches);

  insert into public.imports (club_id, kind, filename, file_hash, mapping, rows_imported, rows_skipped, rows_flagged, report, created_by)
  values (v_club, 'health_status', p_payload->>'filename', p_payload->>'file_hash', p_payload->'mapping',
          v_created + v_updated, v_skipped, v_flagged,
          jsonb_build_object('created', v_created, 'updated', v_updated, 'rows', v_details), (select app_auth.uid()))
  returning id into v_import;
  return jsonb_build_object('import_id', v_import, 'created', v_created, 'updated', v_updated,
                            'skipped', v_skipped, 'flagged', v_flagged);
end $$;

-- Liste nominale: nume complete, date de naștere, post etc.
create or replace function public.import_roster(p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_club uuid := private.my_club();
  r jsonb;
  v_player uuid;
  v_created int := 0; v_updated int := 0; v_skipped int := 0;
  v_matches jsonb := '[]'::jsonb;
  v_import uuid;
  v_details jsonb := '[]'::jsonb;
begin
  if not private.is_physio() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  for r in select * from jsonb_array_elements(coalesce(p_payload->'rows', '[]'::jsonb)) loop
    if coalesce(r->>'action', 'skip') = 'skip' then
      v_skipped := v_skipped + 1;
      v_details := v_details || jsonb_build_object('row', r->'row', 'name', r->>'source_name', 'result', 'skipped');
      continue;
    end if;
    if r->>'action' = 'create' then
      insert into public.players (club_id, group_id, full_name, display_name, birth_date, position, shirt_number, dominant_foot)
      values (v_club, nullif(r->>'group_id', '')::uuid, r->>'full_name',
              coalesce(nullif(r->>'display_name', ''), r->>'full_name'),
              nullif(r->>'birth_date', '')::date, nullif(r->>'position', ''),
              nullif(r->>'shirt_number', '')::smallint, nullif(r->>'dominant_foot', ''))
      returning id into v_player;
      v_created := v_created + 1;
    else
      v_player := (r->>'player_id')::uuid;
      update public.players set
        full_name = coalesce(nullif(r->>'full_name', ''), full_name),
        birth_date = coalesce(nullif(r->>'birth_date', '')::date, birth_date),
        position = coalesce(nullif(r->>'position', ''), position),
        shirt_number = coalesce(nullif(r->>'shirt_number', '')::smallint, shirt_number),
        dominant_foot = coalesce(nullif(r->>'dominant_foot', ''), dominant_foot)
      where id = v_player;
      if not found then raise exception 'Jucător inexistent: %', r->>'source_name'; end if;
      v_updated := v_updated + 1;
    end if;
    v_matches := v_matches || jsonb_build_object('source_name', r->>'match_key', 'group_id', r->>'group_id', 'player_id', v_player);
    v_details := v_details || jsonb_build_object('row', r->'row', 'name', r->>'source_name',
      'result', case when r->>'action' = 'create' then 'created' else 'updated' end);
  end loop;
  perform private.remember_matches(v_club, v_matches);
  insert into public.imports (club_id, kind, filename, file_hash, mapping, rows_imported, rows_skipped, report, created_by)
  values (v_club, 'roster', p_payload->>'filename', p_payload->>'file_hash', p_payload->'mapping',
          v_created + v_updated, v_skipped,
          jsonb_build_object('created', v_created, 'updated', v_updated, 'rows', v_details), (select app_auth.uid()))
  returning id into v_import;
  return jsonb_build_object('import_id', v_import, 'created', v_created, 'updated', v_updated, 'skipped', v_skipped);
end $$;

-- Chestionare (grila săptămânală): un rând = un jucător într-o zi.
create or replace function public.import_wellness(p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_club uuid := private.my_club();
  r jsonb;
  v_player uuid;
  v_new jsonb := '{}'::jsonb;      -- cheie de creare -> id jucător nou
  v_imported int := 0; v_skipped int := 0; v_flagged int := 0; v_created int := 0;
  v_matches jsonb := '[]'::jsonb;
  v_import uuid;
  v_details jsonb := '[]'::jsonb;
begin
  if not private.is_physio() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  for r in select * from jsonb_array_elements(coalesce(p_payload->'rows', '[]'::jsonb)) loop
    if coalesce(r->>'action', 'skip') = 'skip' then
      v_skipped := v_skipped + 1;
      v_details := v_details || jsonb_build_object('row', r->'row', 'name', r->>'source_name', 'date', r->>'entry_date', 'result', 'skipped', 'note', r->>'review_note');
      continue;
    end if;
    if r->>'action' = 'create' then
      -- același nume nou apare pe mai multe zile: îl creăm o singură dată
      if v_new ? (r->>'match_key') then
        v_player := (v_new->>(r->>'match_key'))::uuid;
      else
        insert into public.players (club_id, group_id, full_name, display_name, needs_review, review_note)
        values (v_club, nullif(r->>'group_id', '')::uuid, r->>'source_name', r->>'source_name', true,
                'Creat din importul de chestionare; lipsește din evidența de stare.')
        returning id into v_player;
        v_new := v_new || jsonb_build_object(r->>'match_key', v_player);
        v_created := v_created + 1;
      end if;
    else
      v_player := (r->>'player_id')::uuid;
    end if;
    v_matches := v_matches || jsonb_build_object('source_name', r->>'match_key', 'group_id', r->>'group_id', 'player_id', v_player);

    -- rând fără nicio valoare: doar potrivirea se ține minte
    if nullif(r->>'entry_date', '') is null then continue; end if;

    insert into public.wellness_entries
      (player_id, entry_date, fatigue, muscle_load, pain_zone, pain_side, pain_intensity, pain_note,
       source, needs_review, review_note, raw)
    values
      (v_player, (r->>'entry_date')::date, nullif(r->>'fatigue', '')::smallint, nullif(r->>'muscle_load', '')::smallint,
       nullif(r->>'pain_zone', ''), nullif(r->>'pain_side', ''), nullif(r->>'pain_intensity', '')::smallint,
       nullif(r->>'pain_note', ''), 'import', coalesce((r->>'needs_review')::boolean, false),
       nullif(r->>'review_note', ''), r->'raw')
    on conflict (player_id, entry_date) do update set
      fatigue = excluded.fatigue, muscle_load = excluded.muscle_load, pain_zone = excluded.pain_zone,
      pain_side = excluded.pain_side, pain_intensity = excluded.pain_intensity, pain_note = excluded.pain_note,
      needs_review = excluded.needs_review, review_note = excluded.review_note, raw = excluded.raw
    where public.wellness_entries.source = 'import';   -- nu suprascriem ce a completat jucătorul
    if found then
      v_imported := v_imported + 1;
      if coalesce((r->>'needs_review')::boolean, false) then v_flagged := v_flagged + 1; end if;
      v_details := v_details || jsonb_build_object('row', r->'row', 'name', r->>'source_name', 'date', r->>'entry_date',
        'result', 'imported', 'flagged', coalesce((r->>'needs_review')::boolean, false), 'note', r->>'review_note');
    else
      v_skipped := v_skipped + 1;
      v_details := v_details || jsonb_build_object('row', r->'row', 'name', r->>'source_name', 'date', r->>'entry_date',
        'result', 'skipped', 'note', 'Există deja un chestionar completat în aplicație pentru această zi.');
    end if;
  end loop;
  perform private.remember_matches(v_club, v_matches);
  insert into public.imports (club_id, kind, filename, file_hash, mapping, rows_imported, rows_skipped, rows_flagged, report, created_by)
  values (v_club, 'fatigue_grid', p_payload->>'filename', p_payload->>'file_hash', p_payload->'mapping',
          v_imported, v_skipped, v_flagged,
          jsonb_build_object('players_created', v_created, 'rows', v_details), (select app_auth.uid()))
  returning id into v_import;
  return jsonb_build_object('import_id', v_import, 'imported', v_imported, 'skipped', v_skipped,
                            'flagged', v_flagged, 'players_created', v_created);
end $$;

-- Date fizice (K-Sport sau orice CSV/XLSX mapat). Reimportul aceluiași fișier nu dublează nimic.
create or replace function public.import_physical(p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_club uuid := private.my_club();
  v_source text := coalesce(p_payload->>'source', 'import');
  s jsonb; r jsonb;
  v_session uuid;
  v_import uuid;
  v_imported int := 0; v_skipped int := 0; v_sessions int := 0; v_updated int := 0;
  v_matches jsonb := '[]'::jsonb;
  v_details jsonb := '[]'::jsonb;
  v_exists boolean;
begin
  if not private.is_physio() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  insert into public.imports (club_id, kind, filename, file_hash, mapping, created_by)
  values (v_club, 'physical', p_payload->>'filename', p_payload->>'file_hash', p_payload->'mapping', (select app_auth.uid()))
  returning id into v_import;

  for s in select * from jsonb_array_elements(coalesce(p_payload->'sessions', '[]'::jsonb)) loop
    insert into public.physical_sessions (club_id, group_id, session_date, session_type, name, duration_min, source, import_id)
    values (v_club, nullif(s->>'group_id', '')::uuid, (s->>'session_date')::date,
            coalesce(nullif(s->>'session_type', ''), 'training'), coalesce(s->>'name', ''),
            nullif(s->>'duration_min', '')::int, v_source, v_import)
    on conflict (club_id, session_date, name, source) do update
      set group_id = coalesce(excluded.group_id, public.physical_sessions.group_id),
          duration_min = coalesce(excluded.duration_min, public.physical_sessions.duration_min)
    returning id into v_session;
    v_sessions := v_sessions + 1;

    for r in select * from jsonb_array_elements(coalesce(s->'rows', '[]'::jsonb)) loop
      if nullif(r->>'player_id', '') is null then
        v_skipped := v_skipped + 1;
        v_details := v_details || jsonb_build_object('row', r->'row', 'name', r->>'source_name', 'result', 'skipped', 'note', coalesce(r->>'note', 'Jucător nepotrivit'));
        continue;
      end if;
      select exists (select 1 from public.physical_metrics pm where pm.session_id = v_session and pm.player_id = (r->>'player_id')::uuid) into v_exists;
      insert into public.physical_metrics
        (session_id, player_id, duration_min, total_distance_m, hsr_distance_m, sprint_distance_m, sprint_count,
         max_speed_kmh, accelerations, decelerations, player_load, hr_avg, hr_max, extra)
      values
        (v_session, (r->>'player_id')::uuid, nullif(r->>'duration_min', '')::numeric,
         nullif(r->>'total_distance_m', '')::numeric, nullif(r->>'hsr_distance_m', '')::numeric,
         nullif(r->>'sprint_distance_m', '')::numeric, nullif(r->>'sprint_count', '')::numeric::int,
         nullif(r->>'max_speed_kmh', '')::numeric, nullif(r->>'accelerations', '')::numeric::int,
         nullif(r->>'decelerations', '')::numeric::int, nullif(r->>'player_load', '')::numeric,
         nullif(r->>'hr_avg', '')::numeric::int, nullif(r->>'hr_max', '')::numeric::int,
         coalesce(r->'extra', '{}'::jsonb))
      on conflict (session_id, player_id) do update set
        duration_min = excluded.duration_min, total_distance_m = excluded.total_distance_m,
        hsr_distance_m = excluded.hsr_distance_m, sprint_distance_m = excluded.sprint_distance_m,
        sprint_count = excluded.sprint_count, max_speed_kmh = excluded.max_speed_kmh,
        accelerations = excluded.accelerations, decelerations = excluded.decelerations,
        player_load = excluded.player_load, hr_avg = excluded.hr_avg, hr_max = excluded.hr_max, extra = excluded.extra;
      if v_exists then v_updated := v_updated + 1; else v_imported := v_imported + 1; end if;
      v_matches := v_matches || jsonb_build_object('source_name', r->>'match_key', 'group_id', null, 'player_id', r->>'player_id');
      v_details := v_details || jsonb_build_object('row', r->'row', 'name', r->>'source_name',
        'result', case when v_exists then 'updated' else 'imported' end);
    end loop;
  end loop;
  perform private.remember_matches(v_club, v_matches);
  update public.imports set rows_imported = v_imported + v_updated, rows_skipped = v_skipped,
    report = jsonb_build_object('sessions', v_sessions, 'new', v_imported, 'updated', v_updated, 'rows', v_details)
  where id = v_import;
  return jsonb_build_object('import_id', v_import, 'sessions', v_sessions, 'imported', v_imported,
                            'updated', v_updated, 'skipped', v_skipped);
end $$;

-- ---------------------------------------------------------------------------
-- Sarcini zilnice: chestionare lipsă, vize care expiră, mementouri
-- ---------------------------------------------------------------------------
create or replace function public.refresh_daily_alerts(p_club uuid default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_club uuid;
  v_role text := coalesce((select app_auth.jwt()->>'role'), '');
  v_today date;
  v_missing int;
  v_visa int;
  r record;
  n int := 0;
begin
  if v_role = 'service_role' or (select app_auth.uid()) is null then
    null; -- apel de sistem (cron): toate cluburile sau cel cerut
  elsif private.is_physio() then
    p_club := private.my_club();
  else
    raise exception 'Acces interzis' using errcode = '42501';
  end if;

  for v_club in select c.id from public.clubs c where p_club is null or c.id = p_club loop
    v_today := private.club_today(v_club);
    v_missing := private.club_setting(v_club, '{alerts,missing_days}', 3)::int;
    v_visa := private.club_setting(v_club, '{alerts,visa_days_before}', 30)::int;

    -- N zile la rând fără chestionar (doar jucătorii cu cont, care au completat măcar o dată)
    for r in
      select pl.id, max(w.entry_date) as last_entry
      from public.players pl
      join public.wellness_entries w on w.player_id = pl.id
      where pl.club_id = v_club and pl.is_active and pl.user_id is not null
      group by pl.id
      having max(w.entry_date) <= v_today - v_missing
    loop
      perform private.raise_alert(r.id, 'missing_wellness', 'info', v_today,
        'Fără chestionar de ' || (v_today - r.last_entry) || ' zile',
        jsonb_build_object('last_entry', r.last_entry));
      n := n + 1;
    end loop;

    -- viza medicală expiră curând / a expirat
    for r in
      select pl.id, pl.medical_visa_expires_on as d, pl.user_id
      from public.players pl
      where pl.club_id = v_club and pl.is_active
        and pl.medical_visa_expires_on is not null
        and pl.medical_visa_expires_on <= v_today + v_visa
    loop
      -- o singură alertă pe săptămână pentru aceeași viză
      perform private.raise_alert(r.id, 'visa_expiring',
        case when r.d < v_today then 'critical' else 'warning' end,
        date_trunc('week', v_today)::date,
        case when r.d < v_today then 'Viza medicală a expirat la ' || to_char(r.d, 'DD.MM.YYYY')
             else 'Viza medicală expiră la ' || to_char(r.d, 'DD.MM.YYYY') end,
        jsonb_build_object('expires_on', r.d));
      perform private.notify(r.user_id, 'visa_expiring',
        case when r.d < v_today then 'Viza ta medicală a expirat' else 'Viza ta medicală expiră curând' end,
        'Data: ' || to_char(r.d, 'DD.MM.YYYY'), '/profil', 'visa:' || r.id::text || ':' || r.d::text);
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;

-- Memento „completează chestionarul". Apelat de cron (service_role), o dată pe oră.
create or replace function public.send_wellness_reminders()
returns int language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  if coalesce((select app_auth.jwt()->>'role'), '') <> 'service_role' and (select app_auth.uid()) is not null then
    raise exception 'Acces interzis' using errcode = '42501';
  end if;
  for r in
    select pl.id, pl.user_id, private.club_today(pl.club_id) as today
    from public.players pl
    join public.clubs c on c.id = pl.club_id
    left join public.groups g on g.id = pl.group_id
    where pl.is_active and pl.user_id is not null
      and extract(hour from now() at time zone coalesce(c.settings->>'timezone', 'Europe/Bucharest'))
          >= coalesce(g.reminder_hour, (c.settings->>'reminder_hour')::int, 9)
      and not exists (
        select 1 from public.wellness_entries w
        where w.player_id = pl.id and w.entry_date = private.club_today(pl.club_id))
  loop
    insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
    values (r.user_id, 'wellness_reminder', 'Completează chestionarul de azi',
            'Durează sub 30 de secunde.', '/chestionar', 'wellness:' || r.today::text)
    on conflict do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- GDPR: export, anonimizare, retenție
-- ---------------------------------------------------------------------------
create or replace function private.player_export(p_player uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'jucator', (select to_jsonb(pl) - 'needs_review' - 'review_note' from public.players pl where pl.id = p_player),
    'contact', (select to_jsonb(c) from public.player_contacts c where c.player_id = p_player),
    'istoric_grupe', (select coalesce(jsonb_agg(to_jsonb(h) order by h.from_date), '[]'::jsonb) from public.player_group_history h where h.player_id = p_player),
    'istoric_stare', (select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at), '[]'::jsonb) from public.status_history h where h.player_id = p_player),
    'antropometrie', (select coalesce(jsonb_agg(to_jsonb(a) order by a.measured_on), '[]'::jsonb) from public.anthropometrics a where a.player_id = p_player),
    'accidentari', (select coalesce(jsonb_agg(to_jsonb(i) || jsonb_build_object('tratamente',
                       (select coalesce(jsonb_agg(to_jsonb(t) order by t.treated_on), '[]'::jsonb) from public.injury_treatments t where t.injury_id = i.id))
                     order by i.occurred_on), '[]'::jsonb) from public.injuries i where i.player_id = p_player),
    'documente', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'titlu', d.title, 'tip', d.kind, 'data', d.created_at) order by d.created_at), '[]'::jsonb) from public.medical_documents d where d.player_id = p_player),
    'chestionare', (select coalesce(jsonb_agg(to_jsonb(w) - 'raw' order by w.entry_date), '[]'::jsonb) from public.wellness_entries w where w.player_id = p_player),
    'rpe', (select coalesce(jsonb_agg(to_jsonb(r) order by r.entry_date), '[]'::jsonb) from public.rpe_entries r where r.player_id = p_player),
    'date_fizice', (select coalesce(jsonb_agg(to_jsonb(m) || jsonb_build_object('data', s.session_date, 'sesiune', s.name) order by s.session_date), '[]'::jsonb)
                    from public.physical_metrics m join public.physical_sessions s on s.id = m.session_id where m.player_id = p_player),
    'teste', (select coalesce(jsonb_agg(jsonb_build_object('test', t.name, 'unitate', t.unit, 'data', r.tested_on, 'valoare', r.value) order by r.tested_on), '[]'::jsonb)
              from public.fitness_test_results r join public.fitness_tests t on t.id = r.test_id where r.player_id = p_player),
    'planuri', (select coalesce(jsonb_agg(jsonb_build_object('data', dp.plan_date, 'titlu', dp.title, 'note', dp.notes) order by dp.plan_date), '[]'::jsonb) from public.daily_plans dp where dp.player_id = p_player),
    'exercitii_bifate', (select coalesce(jsonb_agg(to_jsonb(ec) order by ec.done_on), '[]'::jsonb) from public.exercise_completions ec where ec.player_id = p_player),
    'consimtaminte', (select coalesce(jsonb_agg(to_jsonb(cs) order by cs.accepted_at), '[]'::jsonb) from public.consents cs where cs.player_id = p_player)
  )
$$;

-- Exportul datelor proprii (jucător) sau ale unui jucător (preparator).
create or replace function public.export_player_data(p_player uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_player uuid := p_player;
  v_club uuid;
begin
  if v_player is null then
    select pl.id into v_player from public.players pl where pl.user_id = (select app_auth.uid());
  end if;
  if v_player is null then
    -- cont fără fișă de jucător: exportăm profilul
    return jsonb_build_object(
      'exportat_la', now(),
      'profil', (select to_jsonb(p) from public.profiles p where p.id = (select app_auth.uid())),
      'consimtaminte', (select coalesce(jsonb_agg(to_jsonb(cs)), '[]'::jsonb) from public.consents cs where cs.user_id = (select app_auth.uid())));
  end if;
  if not (private.is_self(v_player) or private.can_manage_player(v_player)) then
    raise exception 'Acces interzis' using errcode = '42501';
  end if;
  select pl.club_id into v_club from public.players pl where pl.id = v_player;
  insert into public.audit_log (club_id, actor_id, actor_role, action, entity, entity_id, player_id)
  values (v_club, (select app_auth.uid()), (select private.my_role())::text, 'EXPORT', 'players', v_player::text, v_player);
  return jsonb_build_object('exportat_la', now()) || private.player_export(v_player);
end $$;

-- Anonimizare: păstrează datele statistice, elimină tot ce identifică persoana.
-- Fișierele din storage se șterg de aplicație înainte de apel (vezi lib/gdpr).
create or replace function public.anonymize_player(p_player uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if not private.can_manage_player(p_player) then raise exception 'Acces interzis' using errcode = '42501'; end if;
  select pl.user_id into v_user from public.players pl where pl.id = p_player;
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
  update public.players set
    full_name = 'Jucător anonimizat', display_name = 'Anonimizat ' || left(p_player::text, 4),
    birth_date = case when birth_date is null then null else make_date(extract(year from birth_date)::int, 1, 1) end,
    shirt_number = null, photo_path = null, user_id = null, status_note = null, status_zone_detail = null,
    training_restrictions = null, review_note = null, needs_review = false,
    is_active = false, anonymized_at = now()
  where id = p_player;
  if v_user is not null then
    update public.profiles set is_active = false, full_name = 'Cont anonimizat', email = null, phone = null where id = v_user;
  end if;
end $$;

-- Jucători inactivi a căror perioadă de retenție a expirat (pentru revizuire de către preparator).
create or replace function public.players_past_retention()
returns table (player_id uuid, display_name text, inactive_since timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_club uuid := private.my_club();
  v_months int;
begin
  if not private.is_physio() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  v_months := private.club_setting(v_club, '{retention_months}', 36)::int;
  return query
    select pl.id, pl.display_name, coalesce(
             (select max(a.created_at) from public.audit_log a
               where a.player_id = pl.id and a.entity = 'players' and a.details ? 'is_active'), pl.created_at)
    from public.players pl
    where pl.club_id = v_club and not pl.is_active and pl.anonymized_at is null
      and coalesce(
            (select max(a.created_at) from public.audit_log a
              where a.player_id = pl.id and a.entity = 'players' and a.details ? 'is_active'), pl.created_at)
          < now() - make_interval(months => v_months);
end $$;

-- ---------------------------------------------------------------------------
-- Inițializarea unui club (doar service_role)
-- ---------------------------------------------------------------------------
create or replace function public.setup_club(p_slug text, p_name text, p_short_name text, p_groups text[], p_settings jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_club uuid;
  g text;
  i int := 0;
begin
  insert into public.clubs (slug, name, short_name, settings)
  values (p_slug, p_name, p_short_name, jsonb_build_object(
      'timezone', 'Europe/Bucharest',
      'reminder_hour', 9,
      'medical_visa_validity_months', 6,
      'retention_months', 36,
      'alerts', jsonb_build_object(
        'fatigue_threshold', 8, 'muscle_load_threshold', 8, 'spike_delta', 3,
        'pain_intensity_threshold', 1, 'missing_days', 3, 'visa_days_before', 30)
    ) || coalesce(p_settings, '{}'::jsonb))
  returning id into v_club;

  insert into public.club_statuses (club_id, code, label, short_label, tone, icon, availability, sort) values
    (v_club, 'APT',        'Apt',                 'APT',        'green',  'check',     'full',    1),
    (v_club, 'OBOSEALA',   'Oboseală',            'OBOSEALĂ',   'yellow', 'battery',   'limited', 2),
    (v_club, 'READAPTARE', 'Readaptare la efort', 'READAPTARE', 'orange', 'activity',  'limited', 3),
    (v_club, 'ACC',        'Accidentat',          'ACC',        'red',    'cross',     'out',     4),
    (v_club, 'ALT_MOTIV',  'Alt motiv',           'ALT MOTIV',  'gray',   'help',      'out',     5);

  insert into public.fitness_tests (club_id, code, name, unit, lower_is_better, sort) values
    (v_club, 'sprint_10', 'Sprint 10 m', 's', true, 1),
    (v_club, 'sprint_30', 'Sprint 30 m', 's', true, 2),
    (v_club, 'cmj', 'Săritură CMJ', 'cm', false, 3),
    (v_club, 'yoyo_ir1', 'Yo-Yo IR1', 'm', false, 4),
    (v_club, 'agility_505', 'Agilitate 5-0-5', 's', true, 5);

  foreach g in array coalesce(p_groups, '{}') loop
    i := i + 1;
    insert into public.groups (club_id, name, sort) values (v_club, g, i);
  end loop;
  return v_club;
end $$;

-- ---------------------------------------------------------------------------
-- Drepturi de execuție
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;
grant execute on all functions in schema public to service_role;
grant execute on function
  public.update_my_profile(text, text, boolean),
  public.clear_must_change_password(),
  public.set_my_photo(text),
  public.log_medical_access(uuid, text),
  public.log_event(text, text, jsonb),
  public.club_overview(),
  public.group_test_averages(uuid),
  public.save_program(uuid, text, text, text, boolean, jsonb),
  public.assign_program(uuid, text, uuid, text, uuid[], date, date, smallint[], text),
  public.save_daily_plan(uuid, date, text, text, uuid, smallint, jsonb),
  public.copy_daily_plan(uuid, date[], uuid[]),
  public.import_health_status(jsonb),
  public.import_roster(jsonb),
  public.import_wellness(jsonb),
  public.import_physical(jsonb),
  public.refresh_daily_alerts(uuid),
  public.export_player_data(uuid),
  public.anonymize_player(uuid),
  public.players_past_retention()
to authenticated;
-- setup_club și send_wellness_reminders rămân doar pentru service_role.
alter default privileges in schema public revoke execute on functions from public, anon;
