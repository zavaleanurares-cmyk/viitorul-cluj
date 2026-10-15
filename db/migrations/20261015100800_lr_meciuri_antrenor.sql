-- Locker Room faza 2: ce programează antrenorul.
-- Antrenorul își gestionează (modifică, anulează) antrenamentele, ședințele și amicalele încă nejucate ale
-- echipelor lui. Meciurile din competiții (venite de la federație) și cele jucate rămân la birou.
set local check_function_bodies = off;

create or replace function private.coach_manages_event(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select e.kind in ('training', 'meeting')
        or (e.kind = 'match' and (m.event_id is null or (m.competition_id is null and m.status = 'scheduled')))
    from public.events e left join public.matches m on m.event_id = e.id
    where e.id = p_event), false)
$$;
revoke all on function private.coach_manages_event(uuid) from public;
grant execute on function private.coach_manages_event(uuid) to authenticated;

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
    -- un eveniment comun cu alte echipe îl modifică doar biroul
    if v_id is not null and not (private.event_group_ids(v_id) <@ private.my_group_ids()) then
      raise exception 'Nu poți modifica acest eveniment.' using errcode = '42501';
    end if;
    -- meciurile oficiale (din competiții) le programează și le mută biroul; antrenorul își face amicalele
    if v_kind = 'match' and nullif(p->'match'->>'competition_id', '') is not null then
      raise exception 'Meciurile din competiții le programează biroul.' using errcode = '42501';
    end if;
    if v_id is not null and not private.coach_manages_event(v_id) then
      raise exception 'Nu poți modifica acest eveniment.' using errcode = '42501';
    end if;
  end if;
  if v_id is not null and private.event_club(v_id) is distinct from v_club then
    raise exception 'Eveniment necunoscut.' using errcode = '42501';
  end if;

  if v_kind = 'match' and p ? 'match' then
    v_opp := nullif(p->'match'->>'opponent_id', '')::uuid;
    if v_opp is not null and not exists (select 1 from public.opponents where id = v_opp and club_id = v_club) then
      raise exception 'Adversar necunoscut.' using errcode = '42501';
    end if;
    if nullif(p->'match'->>'competition_id', '') is not null
       and not exists (select 1 from public.competitions where id = (p->'match'->>'competition_id')::uuid and club_id = v_club) then
      raise exception 'Competiție necunoscută.' using errcode = '42501';
    end if;
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
    -- nu mai e meci: scoatem detaliile, dacă meciul nu s-a jucat
    if v_kind <> 'match' then delete from public.matches where event_id = v_id and status = 'scheduled'; end if;
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

create or replace function public.set_event_state(p_event uuid, p_state text, p_scope text default 'one') returns int
language plpgsql security definer set search_path = '' as $$
declare v_ev record; v_n int; v_office boolean := private.is_office(); v_mine uuid[] := private.my_group_ids();
begin
  select * into v_ev from public.events where id = p_event;
  if not found or v_ev.club_id is distinct from private.my_club() then raise exception 'Eveniment necunoscut.' using errcode = '42501'; end if;
  if not v_office and not (
       private.my_role() = 'coach' and private.coach_manages_event(p_event)
       and cardinality(private.event_group_ids(p_event)) > 0 and private.event_group_ids(p_event) <@ v_mine) then
    raise exception 'Nu poți modifica acest eveniment.' using errcode = '42501';
  end if;
  if p_state not in ('cancelled', 'scheduled', 'deleted', 'restored') then raise exception 'Stare necunoscută.'; end if;
  update public.events e set
    status = case when p_state = 'cancelled' then 'cancelled' when p_state = 'scheduled' then 'scheduled' else e.status end,
    deleted_at = case when p_state = 'deleted' then now() when p_state = 'restored' then null else e.deleted_at end
  where ((e.id = p_event)
     or (p_scope = 'following' and v_ev.series_id is not null and e.series_id = v_ev.series_id and e.starts_at >= v_ev.starts_at))
    and (v_office or private.event_group_ids(e.id) <@ v_mine);
  get diagnostics v_n = row_count;
  return v_n;
end $$;
