-- =============================================================================
-- Locker Room · 3 · RPC pentru program, prezență, meci, import de competiții
-- Toate funcțiile verifică explicit cine cheamă; RLS rămâne ultima linie de apărare.
-- =============================================================================

-- Schimbarea clubului / rolului curent (cont cu mai multe membership-uri).
create or replace function public.switch_membership(p_membership uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare m record;
begin
  select * into m from public.memberships
  where id = p_membership and user_id = (select app_auth.uid()) and is_active;
  if not found then raise exception 'Rolul nu există sau nu este activ.' using errcode = '42501'; end if;
  update public.profiles set club_id = m.club_id, role = m.role where id = m.user_id;
  delete from public.staff_groups sg using public.groups g
   where sg.user_id = m.user_id and g.id = sg.group_id and g.club_id <> m.club_id;
end $$;

-- ---------------------------------------------------------------------------
-- Evenimente
-- p: { id?, kind, title, starts_at, ends_at, venue_id?, notes?, group_ids[],
--      repeat?: { weekdays[], until }, match?: { competition_id?, opponent_name?, opponent_id?, round?, is_home } }
-- Biroul poate crea orice; antrenorul doar antrenamente/ședințe/meciuri ale echipelor lui.
-- ---------------------------------------------------------------------------
create or replace function public.save_event(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_club    uuid := private.my_club();
  v_role    public.app_role := private.my_role();
  v_groups  uuid[] := coalesce(array(select jsonb_array_elements_text(coalesce(p->'group_ids', '[]'))::uuid), '{}');
  v_id      uuid := nullif(p->>'id', '')::uuid;
  v_kind    text := p->>'kind';
  v_start   timestamptz := (p->>'starts_at')::timestamptz;
  v_end     timestamptz := (p->>'ends_at')::timestamptz;
  v_venue   uuid := nullif(p->>'venue_id', '')::uuid;
  v_title   text := nullif(trim(coalesce(p->>'title', '')), '');
  v_tz      text;
  v_series  uuid;
  v_day     date;
  v_until   date;
  v_weekdays smallint[];
  v_dur     interval;
  v_local_start time;
  v_opp     uuid;
  v_ids     uuid[] := '{}';
  v_one     uuid;
begin
  if v_club is null then raise exception 'Sesiune invalidă.' using errcode = '42501'; end if;
  if v_kind not in ('training', 'match', 'booking', 'meeting', 'other') then raise exception 'Tip de eveniment necunoscut.'; end if;
  if v_start is null or v_end is null or v_end <= v_start then raise exception 'Ora de sfârșit trebuie să fie după ora de început.'; end if;
  if exists (select 1 from unnest(v_groups) g where private.group_club(g) is distinct from v_club) then
    raise exception 'Echipă necunoscută.' using errcode = '42501';
  end if;
  if v_venue is not null and not exists (select 1 from public.venues where id = v_venue and club_id = v_club) then
    raise exception 'Teren necunoscut.' using errcode = '42501';
  end if;
  if not private.is_office() then
    if v_role <> 'coach' or cardinality(v_groups) = 0 or not (v_groups <@ private.my_group_ids())
       or v_kind not in ('training', 'meeting', 'match') then
      raise exception 'Poți programa doar pentru echipele tale.' using errcode = '42501';
    end if;
    if v_id is not null and not private.can_run_event(v_id) then
      raise exception 'Nu poți modifica acest eveniment.' using errcode = '42501';
    end if;
  end if;
  if v_id is not null and private.event_club(v_id) is distinct from v_club then
    raise exception 'Eveniment necunoscut.' using errcode = '42501';
  end if;

  if v_kind = 'match' and p ? 'match' then
    v_opp := nullif(p->'match'->>'opponent_id', '')::uuid;
    if v_opp is null and nullif(trim(coalesce(p->'match'->>'opponent_name', '')), '') is not null then
      insert into public.opponents (club_id, name) values (v_club, trim(p->'match'->>'opponent_name'))
      on conflict (club_id, name) do update set name = excluded.name
      returning id into v_opp;
    end if;
    if v_title is null then
      select coalesce(o.short_name, o.name) into v_title from public.opponents o where o.id = v_opp;
      v_title := coalesce(v_title, 'Meci');
    end if;
  end if;
  v_title := coalesce(v_title, case v_kind when 'training' then 'Antrenament' when 'match' then 'Meci'
                                            when 'booking' then 'Rezervare' when 'meeting' then 'Ședință' else 'Eveniment' end);

  -- Modificarea unui eveniment existent (doar acela, nu toată seria)
  if v_id is not null then
    update public.events set kind = v_kind, title = v_title, starts_at = v_start, ends_at = v_end,
      venue_id = v_venue, notes = nullif(p->>'notes', '')
    where id = v_id and deleted_at is null;
    delete from public.event_teams where event_id = v_id and not (group_id = any (v_groups));
    insert into public.event_teams (event_id, group_id) select v_id, g from unnest(v_groups) g on conflict do nothing;
    v_ids := array[v_id];
  elsif p ? 'repeat' and jsonb_typeof(p->'repeat') = 'object' then
    select coalesce(c.settings->>'timezone', 'Europe/Bucharest') into v_tz from public.clubs c where c.id = v_club;
    v_weekdays := array(select (jsonb_array_elements_text(p->'repeat'->'weekdays'))::smallint);
    v_until := (p->'repeat'->>'until')::date;
    v_day := (v_start at time zone v_tz)::date;
    v_local_start := (v_start at time zone v_tz)::time;
    v_dur := v_end - v_start;
    if v_until is null or v_until < v_day or v_until > v_day + 400 then raise exception 'Repetarea poate ține cel mult 400 de zile.'; end if;
    insert into public.event_series (club_id, kind, title, weekdays, start_time, duration_min, venue_id, starts_on, until, group_ids, created_by)
    values (v_club, v_kind, v_title, v_weekdays, v_local_start, extract(epoch from v_dur)::int / 60, v_venue, v_day, v_until, v_groups, app_auth.uid())
    returning id into v_series;
    while v_day <= v_until loop
      if extract(isodow from v_day)::smallint = any (v_weekdays) then
        insert into public.events (club_id, kind, title, starts_at, ends_at, venue_id, series_id, notes, created_by)
        values (v_club, v_kind, v_title, (v_day + v_local_start) at time zone v_tz, ((v_day + v_local_start) at time zone v_tz) + v_dur,
                v_venue, v_series, nullif(p->>'notes', ''), app_auth.uid())
        returning id into v_one;
        insert into public.event_teams (event_id, group_id) select v_one, g from unnest(v_groups) g;
        v_ids := v_ids || v_one;
      end if;
      v_day := v_day + 1;
    end loop;
    if cardinality(v_ids) = 0 then raise exception 'Nicio zi din interval nu se potrivește zilelor alese.'; end if;
  else
    insert into public.events (club_id, kind, title, starts_at, ends_at, venue_id, notes, created_by)
    values (v_club, v_kind, v_title, v_start, v_end, v_venue, nullif(p->>'notes', ''), app_auth.uid())
    returning id into v_one;
    insert into public.event_teams (event_id, group_id) select v_one, g from unnest(v_groups) g;
    v_ids := array[v_one];
  end if;

  if v_kind = 'match' then
    insert into public.matches (event_id, competition_id, opponent_id, round, is_home)
    select e, nullif(p->'match'->>'competition_id', '')::uuid, v_opp, nullif(p->'match'->>'round', ''),
           coalesce((p->'match'->>'is_home')::boolean, true)
    from unnest(v_ids) e
    on conflict (event_id) do update set competition_id = excluded.competition_id, opponent_id = excluded.opponent_id,
      round = excluded.round, is_home = excluded.is_home;
  end if;
  return v_ids[1];
end $$;

-- Anulare (rămâne în calendar, tăiat) sau ștergere în coș (deleted_at); p_scope: 'one' | 'following'
create or replace function public.set_event_state(p_event uuid, p_state text, p_scope text default 'one') returns int
language plpgsql security definer set search_path = '' as $$
declare v_ev record; v_n int;
begin
  select * into v_ev from public.events where id = p_event;
  if not found or v_ev.club_id is distinct from private.my_club() then raise exception 'Eveniment necunoscut.' using errcode = '42501'; end if;
  if not (private.is_office() or (private.can_run_event(p_event) and (v_ev.created_by = app_auth.uid() or v_ev.series_id is not null or v_ev.kind <> 'booking'))) then
    raise exception 'Nu poți modifica acest eveniment.' using errcode = '42501';
  end if;
  if p_state not in ('cancelled', 'scheduled', 'deleted', 'restored') then raise exception 'Stare necunoscută.'; end if;
  update public.events e set
    status = case when p_state = 'cancelled' then 'cancelled' when p_state = 'scheduled' then 'scheduled' else e.status end,
    deleted_at = case when p_state = 'deleted' then now() when p_state = 'restored' then null else e.deleted_at end
  where (e.id = p_event)
     or (p_scope = 'following' and v_ev.series_id is not null and e.series_id = v_ev.series_id and e.starts_at >= v_ev.starts_at);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------------------------------------------------------------------------
-- Prezență (offline): p_rows = [{ player_id, status, reason?, note?, recorded_at }]
-- Ultima scriere câștigă după recorded_at (ora din telefon), deci o sincronizare întârziată
-- nu suprascrie o corectură făcută între timp.
-- ---------------------------------------------------------------------------
create or replace function public.save_attendance(p_event uuid, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare v_groups uuid[]; v_n int;
begin
  if not private.can_run_event(p_event) then raise exception 'Nu poți face prezența la acest eveniment.' using errcode = '42501'; end if;
  v_groups := private.event_group_ids(p_event);
  insert into public.attendance as a (event_id, player_id, status, reason, note, recorded_by, recorded_at, synced_at)
  select p_event, (r->>'player_id')::uuid, r->>'status', nullif(r->>'reason', ''), nullif(r->>'note', ''),
         app_auth.uid(), least(coalesce((r->>'recorded_at')::timestamptz, now()), now()), now()
  from jsonb_array_elements(p_rows) r
  join public.players pl on pl.id = (r->>'player_id')::uuid
  where pl.club_id = private.my_club()
  on conflict (event_id, player_id) do update set
    status = excluded.status, reason = excluded.reason, note = excluded.note,
    recorded_by = excluded.recorded_by, recorded_at = excluded.recorded_at, synced_at = now()
  where excluded.recorded_at >= a.recorded_at;
  get diagnostics v_n = row_count;
  update public.events set attendance_saved_at = now() where id = p_event;
  return v_n;
end $$;

-- ---------------------------------------------------------------------------
-- Meci: cine poate fi convocat
-- ---------------------------------------------------------------------------
create or replace function public.match_eligibility(p_event uuid)
returns table (player_id uuid, reason text, detail text, until_date date)
language sql stable security definer set search_path = '' as $$
  with ev as (
    select e.id, e.club_id, (e.starts_at at time zone coalesce(c.settings->>'timezone', 'Europe/Bucharest'))::date as day,
           m.competition_id
    from public.events e join public.clubs c on c.id = e.club_id
    left join public.matches m on m.event_id = e.id
    where e.id = p_event and private.can_see_event(e.id)
  ),
  roster as (
    select pl.* from public.players pl, ev
    where pl.club_id = ev.club_id and pl.is_active and pl.anonymized_at is null
      and pl.group_id = any (private.event_group_ids(ev.id))
  )
  select r.id, 'injured', coalesce(nullif(r.status_note, ''), s.label), r.status_return_on
  from roster r join public.club_statuses s on s.id = r.status_id
  where s.availability = 'out'
  union all
  select r.id, 'visa', 'Viza medicală ' || case when r.medical_visa_expires_on is null then 'lipsește'
           else 'a expirat pe ' || to_char(r.medical_visa_expires_on, 'DD.MM.YYYY') end, r.medical_visa_expires_on
  from roster r, ev where r.medical_visa_expires_on is null or r.medical_visa_expires_on < ev.day
  union all
  select r.id, 'suspended', su.reason, null::date
  from roster r join public.suspensions su on su.player_id = r.id and su.matches_remaining > 0, ev
  where su.competition_id is null or su.competition_id is not distinct from ev.competition_id
$$;

-- Lotul și formația: p_rows = [{ player_id, role: starter|sub, slot?, is_captain? }]
create or replace function public.save_match_squad(p_event uuid, p_formation text, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare v_blocked text; v_n int; v_status text;
begin
  if not private.can_run_event(p_event) then raise exception 'Nu poți alege lotul la acest meci.' using errcode = '42501'; end if;
  select status into v_status from public.matches where event_id = p_event;
  if v_status is null then raise exception 'Evenimentul nu este un meci.'; end if;
  if v_status = 'finished' then raise exception 'Meciul este închis.'; end if;
  select string_agg(distinct pl.display_name, ', ') into v_blocked
  from jsonb_array_elements(p_rows) r
  join public.match_eligibility(p_event) me on me.player_id = (r->>'player_id')::uuid
  join public.players pl on pl.id = me.player_id;
  if v_blocked is not null then raise exception 'Nu pot fi convocați: %.', v_blocked; end if;
  if (select count(*) from jsonb_array_elements(p_rows) r where r->>'role' = 'starter')
     > coalesce((select max(g.players_on_pitch) from public.groups g where g.id = any (private.event_group_ids(p_event))), 11) then
    raise exception 'Prea mulți titulari.';
  end if;
  delete from public.match_squad ms where ms.event_id = p_event
    and not exists (select 1 from jsonb_array_elements(p_rows) r where (r->>'player_id')::uuid = ms.player_id);
  insert into public.match_squad (event_id, player_id, role, slot, is_captain)
  select p_event, (r->>'player_id')::uuid, r->>'role', nullif(r->>'slot', '')::smallint, coalesce((r->>'is_captain')::boolean, false)
  from jsonb_array_elements(p_rows) r
  join public.players pl on pl.id = (r->>'player_id')::uuid and pl.club_id = private.my_club()
  on conflict (event_id, player_id) do update set role = excluded.role, slot = excluded.slot, is_captain = excluded.is_captain;
  get diagnostics v_n = row_count;
  update public.matches set formation = nullif(p_formation, '') where event_id = p_event;
  return v_n;
end $$;

create or replace function private.recount_score(p_event uuid) returns void
language sql security definer set search_path = '' as $$
  update public.matches m set
    goals_for = (select count(*) from public.match_events e where e.event_id = p_event and e.kind = 'goal'),
    goals_against = (select count(*) from public.match_events e where e.event_id = p_event and e.kind in ('goal_against', 'own_goal'))
  where m.event_id = p_event
$$;

-- p: { minute, kind, player_id?, related_player_id?, note? }
create or replace function public.add_match_event(p_event uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_status text;
begin
  if not private.can_run_event(p_event) then raise exception 'Nu poți modifica acest meci.' using errcode = '42501'; end if;
  select status into v_status from public.matches where event_id = p_event;
  if v_status is null then raise exception 'Evenimentul nu este un meci.'; end if;
  if v_status = 'finished' then raise exception 'Meciul este închis.'; end if;
  if (p->>'kind') in ('goal', 'yellow', 'red', 'sub') and nullif(p->>'player_id', '') is null then
    raise exception 'Alege jucătorul.';
  end if;
  if exists (select 1 from public.players pl where pl.id in (nullif(p->>'player_id', '')::uuid, nullif(p->>'related_player_id', '')::uuid)
             and pl.club_id <> private.my_club()) then
    raise exception 'Jucător necunoscut.' using errcode = '42501';
  end if;
  insert into public.match_events (event_id, minute, kind, player_id, related_player_id, note, created_by)
  values (p_event, greatest(0, least(150, coalesce((p->>'minute')::int, 0))), p->>'kind',
          nullif(p->>'player_id', '')::uuid, nullif(p->>'related_player_id', '')::uuid, nullif(p->>'note', ''), app_auth.uid())
  returning id into v_id;
  update public.matches set status = 'live' where event_id = p_event and status = 'scheduled';
  perform private.recount_score(p_event);
  return v_id;
end $$;

create or replace function public.delete_match_event(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_event uuid;
begin
  select event_id into v_event from public.match_events where id = p_id;
  if v_event is null or not private.can_run_event(v_event) then raise exception 'Nu poți modifica acest meci.' using errcode = '42501'; end if;
  if (select status from public.matches where event_id = v_event) = 'finished' then raise exception 'Meciul este închis.'; end if;
  delete from public.match_events where id = p_id;
  perform private.recount_score(v_event);
end $$;

-- Închiderea meciului: minute jucate din schimbări, note, suspendări.
-- p_ratings = { "<player_id>": 1..5 }
create or replace function public.close_match(p_event uuid, p_ratings jsonb default '{}'::jsonb, p_report text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_m record; v_total int; v_comp record; r record; v_yellows int;
begin
  if not private.can_run_event(p_event) then raise exception 'Nu poți închide acest meci.' using errcode = '42501'; end if;
  select m.*, e.club_id into v_m from public.matches m join public.events e on e.id = m.event_id where m.event_id = p_event;
  if v_m.event_id is null then raise exception 'Evenimentul nu este un meci.'; end if;
  if v_m.status = 'finished' then raise exception 'Meciul este deja închis.'; end if;
  select * into v_comp from public.competitions where id = v_m.competition_id;
  v_total := 2 * coalesce(v_comp.half_minutes,
    (select max(g.half_minutes) from public.groups g where g.id = any (private.event_group_ids(p_event))), 45);

  -- minute: titularii până la ieșire, rezervele de la intrare (0 dacă n-au intrat)
  update public.match_squad ms set minutes = case
      when ms.role = 'starter' then coalesce((select min(e.minute) from public.match_events e
                                              where e.event_id = p_event and e.kind = 'sub' and e.player_id = ms.player_id), v_total)
      else coalesce(v_total - (select min(e.minute) from public.match_events e
                               where e.event_id = p_event and e.kind = 'sub' and e.related_player_id = ms.player_id), 0)
    end,
    rating = case when p_ratings ? ms.player_id::text then greatest(1, least(5, (p_ratings->>ms.player_id::text)::int)) else ms.rating end
  where ms.event_id = p_event;
  -- un jucător intrat și scos din nou: scădem minutele de după a doua ieșire
  update public.match_squad ms set minutes = greatest(0, ms.minutes - (v_total - x.out_min))
  from (select e.player_id, min(e.minute) as out_min from public.match_events e
        where e.event_id = p_event and e.kind = 'sub' group by e.player_id) x
  where ms.event_id = p_event and ms.role = 'sub' and x.player_id = ms.player_id;

  -- suspendările ispășite: jucătorii suspendați în aceeași competiție care nu au fost în lot
  update public.suspensions su set matches_remaining = matches_remaining - 1
  where su.club_id = v_m.club_id and su.matches_remaining > 0
    and (su.competition_id is null or su.competition_id is not distinct from v_m.competition_id)
    and su.source_event_id is distinct from p_event
    and exists (select 1 from public.players pl where pl.id = su.player_id and pl.group_id = any (private.event_group_ids(p_event)))
    and not exists (select 1 from public.match_squad ms where ms.event_id = p_event and ms.player_id = su.player_id);

  -- suspendări noi: roșu = 1 etapă; galbene la fiecare prag al competiției
  for r in select e.player_id, e.kind from public.match_events e
           where e.event_id = p_event and e.kind in ('yellow', 'red') and e.player_id is not null loop
    if r.kind = 'red' then
      insert into public.suspensions (club_id, player_id, competition_id, reason, source_event_id)
      values (v_m.club_id, r.player_id, v_m.competition_id, 'Cartonaș roșu', p_event);
    elsif v_m.competition_id is not null then
      select count(*) into v_yellows from public.match_events e2 join public.matches m2 on m2.event_id = e2.event_id
      where e2.player_id = r.player_id and e2.kind = 'yellow' and m2.competition_id = v_m.competition_id;
      if v_yellows > 0 and v_yellows % v_comp.yellow_limit = 0 then
        insert into public.suspensions (club_id, player_id, competition_id, reason, source_event_id)
        values (v_m.club_id, r.player_id, v_m.competition_id, v_yellows || ' cartonașe galbene', p_event);
      end if;
    end if;
  end loop;

  update public.matches set status = 'finished', closed_at = now(), closed_by = app_auth.uid(),
    report = coalesce(nullif(p_report, ''), report)
  where event_id = p_event;
  update public.events set status = 'done' where id = p_event;
end $$;

-- Redeschiderea meciului (birou), de ex. pentru o corectură de scor.
create or replace function public.reopen_match(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (private.is_office() and private.event_club(p_event) = private.my_club()) then
    raise exception 'Doar biroul poate redeschide un meci.' using errcode = '42501';
  end if;
  delete from public.suspensions where source_event_id = p_event;
  update public.matches set status = 'live', closed_at = null, closed_by = null where event_id = p_event;
  update public.events set status = 'scheduled' where id = p_event;
end $$;

-- ---------------------------------------------------------------------------
-- Import de program din listele federației (FRF / AJF / AMFB)
-- p_rows = [{ round, starts_at, home, away, venue?, home_goals?, away_goals? }]
-- Rândurile în care nu apare echipa noastră (competitions.own_name) sunt ignorate.
-- Idempotent: aceeași etapă cu același adversar actualizează meciul existent.
-- ---------------------------------------------------------------------------
create or replace function public.import_fixtures(p_competition uuid, p_rows jsonb, p_duration_min int default 120)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_comp record; r jsonb; v_home boolean; v_opp_name text; v_opp uuid; v_key text; v_event uuid;
  v_start timestamptz; v_created int := 0; v_updated int := 0; v_skipped int := 0; v_own text;
begin
  select * into v_comp from public.competitions where id = p_competition;
  if v_comp.id is null or v_comp.club_id <> private.my_club() or not private.is_office() then
    raise exception 'Nu poți importa în această competiție.' using errcode = '42501';
  end if;
  if v_comp.group_id is null then raise exception 'Alege întâi echipa noastră din competiție.'; end if;
  v_own := lower(public.unaccent_ro(coalesce(v_comp.own_name, '')));
  if v_own = '' then raise exception 'Completează numele echipei noastre așa cum apare în lista federației.'; end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_start := nullif(r->>'starts_at', '')::timestamptz;
    if lower(public.unaccent_ro(coalesce(r->>'home', ''))) like '%' || v_own || '%' then
      v_home := true; v_opp_name := trim(r->>'away');
    elsif lower(public.unaccent_ro(coalesce(r->>'away', ''))) like '%' || v_own || '%' then
      v_home := false; v_opp_name := trim(r->>'home');
    else
      v_skipped := v_skipped + 1; continue;
    end if;
    if v_start is null or coalesce(v_opp_name, '') = '' then v_skipped := v_skipped + 1; continue; end if;

    insert into public.opponents (club_id, name) values (v_comp.club_id, v_opp_name)
    on conflict (club_id, name) do update set name = excluded.name returning id into v_opp;
    v_key := coalesce(r->>'round', '') || '|' || lower(public.unaccent_ro(v_opp_name)) || '|' || case when v_home then 'h' else 'a' end;

    select m.event_id into v_event from public.matches m where m.competition_id = p_competition and m.external_key = v_key;
    if v_event is null then
      insert into public.events (club_id, kind, title, starts_at, ends_at, notes, created_by)
      values (v_comp.club_id, 'match', v_opp_name, v_start, v_start + make_interval(mins => p_duration_min),
              nullif(r->>'venue', ''), app_auth.uid())
      returning id into v_event;
      insert into public.event_teams (event_id, group_id) values (v_event, v_comp.group_id);
      insert into public.matches (event_id, competition_id, opponent_id, round, is_home, external_key)
      values (v_event, p_competition, v_opp, nullif(r->>'round', ''), v_home, v_key);
      v_created := v_created + 1;
    else
      update public.events set starts_at = v_start, ends_at = v_start + make_interval(mins => p_duration_min),
        notes = coalesce(nullif(r->>'venue', ''), notes)
      where id = v_event and status <> 'done';
      v_updated := v_updated + 1;
    end if;
    -- scorul oficial, dacă lista îl are și meciul nu e deja închis în aplicație
    if nullif(r->>'home_goals', '') is not null and nullif(r->>'away_goals', '') is not null then
      update public.matches set
        goals_for = case when v_home then (r->>'home_goals')::int else (r->>'away_goals')::int end,
        goals_against = case when v_home then (r->>'away_goals')::int else (r->>'home_goals')::int end
      where event_id = v_event and status <> 'finished'
        and not exists (select 1 from public.match_events e where e.event_id = v_event);
    end if;
  end loop;
  return jsonb_build_object('created', v_created, 'updated', v_updated, 'skipped', v_skipped);
end $$;

-- Clasamentul: înlocuit complet la fiecare import.
create or replace function public.import_standings(p_competition uuid, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare v_comp record; v_own text; v_n int;
begin
  select * into v_comp from public.competitions where id = p_competition;
  if v_comp.id is null or v_comp.club_id <> private.my_club() or not private.is_office() then
    raise exception 'Nu poți importa în această competiție.' using errcode = '42501';
  end if;
  v_own := lower(public.unaccent_ro(coalesce(v_comp.own_name, '')));
  delete from public.competition_standings where competition_id = p_competition;
  insert into public.competition_standings (competition_id, position, team_name, played, won, drawn, lost, goals_for, goals_against, points, is_own)
  select p_competition, (r->>'position')::smallint, trim(r->>'team'), coalesce((r->>'played')::smallint, 0),
         coalesce((r->>'won')::smallint, 0), coalesce((r->>'drawn')::smallint, 0), coalesce((r->>'lost')::smallint, 0),
         coalesce((r->>'goals_for')::smallint, 0), coalesce((r->>'goals_against')::smallint, 0), coalesce((r->>'points')::smallint, 0),
         v_own <> '' and lower(public.unaccent_ro(r->>'team')) like '%' || v_own || '%'
  from jsonb_array_elements(p_rows) r
  where nullif(r->>'position', '') is not null and nullif(trim(r->>'team'), '') is not null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Diacritice românești → litere simple (fără extensia unaccent).
create or replace function public.unaccent_ro(p text) returns text
language sql immutable set search_path = '' as $$
  select translate(coalesce(p, ''), 'ăâîșşțţĂÂÎȘŞȚŢáéíóúöüőűÁÉÍÓÚÖÜŐŰ', 'aaissttAAISSTTaeiouououAEIOUOUOU')
$$;

-- ---------------------------------------------------------------------------
-- Drepturi de execuție
-- ---------------------------------------------------------------------------
revoke execute on function
  public.switch_membership(uuid), public.save_event(jsonb), public.set_event_state(uuid, text, text),
  public.save_attendance(uuid, jsonb), public.match_eligibility(uuid), public.save_match_squad(uuid, text, jsonb),
  public.add_match_event(uuid, jsonb), public.delete_match_event(uuid), public.close_match(uuid, jsonb, text),
  public.reopen_match(uuid), public.import_fixtures(uuid, jsonb, int), public.import_standings(uuid, jsonb),
  public.unaccent_ro(text)
from public, anon;
grant execute on function
  public.switch_membership(uuid), public.save_event(jsonb), public.set_event_state(uuid, text, text),
  public.save_attendance(uuid, jsonb), public.match_eligibility(uuid), public.save_match_squad(uuid, text, jsonb),
  public.add_match_event(uuid, jsonb), public.delete_match_event(uuid), public.close_match(uuid, jsonb, text),
  public.reopen_match(uuid), public.import_fixtures(uuid, jsonb, int), public.import_standings(uuid, jsonb),
  public.unaccent_ro(text)
to authenticated, service_role;
revoke execute on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;
