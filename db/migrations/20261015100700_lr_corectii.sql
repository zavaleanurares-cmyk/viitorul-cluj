-- =============================================================================
-- Locker Room · 8 · Corecturi după revizuirea fazei 2
--   * schimbarea rolului dezactivează vechiul rol (nu se mai poate reveni din „Schimbă rolul”);
--   * grupele antrenorului se citesc doar din clubul curent (nu se mai șterg la schimbarea clubului);
--   * eligibilitatea se verifică pentru jucătorii trimiși (și cei din alte echipe), cu detaliul medical
--     doar pentru cine conduce meciul;
--   * notele de meci într-un tabel separat, vizibil doar staff-ului; patronul nu mai vede rânduri individuale;
--   * închiderea meciului: minute fără valori negative, galbene la prag (inclusiv două într-un meci),
--     fără suspendări din amicale, redeschiderea anulează și etapele ispășite;
--   * autogolul adversarului; antrenorul anulează doar antrenamentele/ședințele echipelor lui;
--   * potrivirea numelor de echipe la import, identică cu cea din browser.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Conturi și roluri
-- ---------------------------------------------------------------------------
create or replace function private.my_group_ids() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(sg.group_id), '{}'::uuid[])
  from public.staff_groups sg
  join public.profiles p on p.id = sg.user_id and p.is_active
  join public.groups g on g.id = sg.group_id and g.club_id = p.club_id
  where sg.user_id = (select app_auth.uid())
$$;

create or replace function public.switch_membership(p_membership uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare m record;
begin
  select * into m from public.memberships
  where id = p_membership and user_id = (select app_auth.uid()) and is_active;
  if not found then raise exception 'Rolul nu există sau nu este activ.' using errcode = '42501'; end if;
  perform set_config('app.switching', 'on', true);
  update public.profiles set club_id = m.club_id, role = m.role, is_active = true where id = m.user_id;
  perform set_config('app.switching', 'off', true);
end $$;

-- Schimbarea rolului sau dezactivarea din administrare (nu din „Schimbă rolul”) închide vechiul rol.
create or replace function private.profiles_sync_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and coalesce(current_setting('app.switching', true), '') <> 'on' then
    if new.role is distinct from old.role and new.club_id = old.club_id then
      update public.memberships set is_active = false
      where user_id = new.id and club_id = old.club_id and role = old.role;
    end if;
    if not new.is_active then
      update public.memberships set is_active = false where user_id = new.id and club_id = new.club_id;
      return new;
    end if;
  end if;
  insert into public.memberships (user_id, club_id, role, is_active)
  values (new.id, new.club_id, new.role, new.is_active)
  on conflict (user_id, club_id, role) do update set is_active = excluded.is_active;
  return new;
end $$;

-- Dezactivarea rolului curent: contul trece pe alt rol activ sau, dacă nu are, se dezactivează.
create or replace function private.memberships_after_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_next record;
begin
  if old.is_active and not new.is_active and exists (
    select 1 from public.profiles p where p.id = new.user_id and p.club_id = new.club_id and p.role = new.role and p.is_active
  ) then
    select * into v_next from public.memberships
    where user_id = new.user_id and is_active and id <> new.id order by created_at limit 1;
    perform set_config('app.switching', 'on', true);
    if found then
      update public.profiles set club_id = v_next.club_id, role = v_next.role where id = new.user_id;
    else
      update public.profiles set is_active = false where id = new.user_id;
    end if;
    perform set_config('app.switching', 'off', true);
  end if;
  return null;
end $$;
create trigger memberships_after_update after update of is_active on public.memberships
  for each row execute function private.memberships_after_update();

-- Rolurile închise până acum, pentru conturile al căror rol a fost deja schimbat.
update public.memberships m set is_active = false
from public.profiles p
where p.id = m.user_id and p.club_id = m.club_id and m.role <> p.role and m.is_active
  and m.role <> 'guardian';

-- ---------------------------------------------------------------------------
-- Politici: patronul fără rânduri individuale; părinții fără câmpurile biroului
-- ---------------------------------------------------------------------------
drop policy attendance_select on public.attendance;
create policy attendance_select on public.attendance for select to authenticated
  using (
    private.event_club(event_id) = (select private.my_club())
    and (
      (select private.my_role()) in ('admin', 'secretary', 'sporting_director', 'physio')
      or private.can_run_event(event_id)
      or player_id = any ((select private.my_player_ids())::uuid[])
    )
  );

drop policy suspensions_select on public.suspensions;
create policy suspensions_select on public.suspensions for select to authenticated
  using (club_id = (select private.my_club())
     and ((select private.my_role()) in ('admin', 'secretary', 'sporting_director', 'physio', 'coach', 'accountant')
          or player_id = any ((select private.my_player_ids())::uuid[])));

drop policy match_squad_select on public.match_squad;
create policy match_squad_select on public.match_squad for select to authenticated
  using (private.can_see_event(event_id) and (select private.my_role()) <> 'owner');

drop policy guardians_update_self on public.guardians;

drop policy guardian_players_write on public.guardian_players;
create policy guardian_players_write on public.guardian_players for all to authenticated
  using (private.guardian_club(guardian_id) = (select private.my_club()) and (select private.is_office()))
  with check (private.guardian_club(guardian_id) = (select private.my_club()) and (select private.is_office())
          and exists (select 1 from public.players pl where pl.id = player_id and pl.club_id = (select private.my_club())));

-- ---------------------------------------------------------------------------
-- Notele de meci: separat, doar pentru staff
-- ---------------------------------------------------------------------------
create table public.match_ratings (
  event_id   uuid not null references public.matches(event_id) on delete cascade deferrable initially deferred,
  player_id  uuid not null references public.players(id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  rated_by   uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, player_id)
);

alter table public.match_ratings enable row level security;
grant select, insert, update, delete on public.match_ratings to authenticated;
grant all on public.match_ratings to service_role;
create policy match_ratings_select on public.match_ratings for select to authenticated
  using (private.event_club(event_id) = (select private.my_club())
     and ((select private.my_role()) in ('admin', 'sporting_director', 'physio') or private.can_run_event(event_id)));
create trigger match_ratings_audit after insert or update or delete on public.match_ratings
  for each row execute function private.audit();
insert into public.match_ratings (event_id, player_id, rating)
select event_id, player_id, rating from public.match_squad where rating is not null;
alter table public.match_squad drop column rating;

-- ---------------------------------------------------------------------------
-- Evenimente de meci: autogolul adversarului
-- ---------------------------------------------------------------------------
alter table public.match_events drop constraint match_events_kind_check;
alter table public.match_events add constraint match_events_kind_check
  check (kind in ('goal', 'opp_own_goal', 'own_goal', 'goal_against', 'yellow', 'red', 'sub'));

create or replace function private.recount_score(p_event uuid) returns void
language sql security definer set search_path = '' as $$
  update public.matches m set
    goals_for = (select count(*) from public.match_events e where e.event_id = p_event and e.kind in ('goal', 'opp_own_goal')),
    goals_against = (select count(*) from public.match_events e where e.event_id = p_event and e.kind in ('goal_against', 'own_goal'))
  where m.event_id = p_event
$$;

-- ---------------------------------------------------------------------------
-- Eligibilitate
-- ---------------------------------------------------------------------------
create or replace function private.eligibility_for(p_event uuid, p_players uuid[])
returns table (player_id uuid, reason text, detail text, until_date date)
language sql stable security definer set search_path = '' as $$
  with ev as (
    select e.id, e.club_id, (e.starts_at at time zone coalesce(c.settings->>'timezone', 'Europe/Bucharest'))::date as day,
           m.competition_id
    from public.events e join public.clubs c on c.id = e.club_id
    left join public.matches m on m.event_id = e.id
    where e.id = p_event
  ),
  roster as (
    select pl.* from public.players pl, ev where pl.club_id = ev.club_id and pl.id = any (p_players)
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

create or replace function public.match_eligibility(p_event uuid)
returns table (player_id uuid, reason text, detail text, until_date date)
language sql stable security definer set search_path = '' as $$
  select x.player_id, x.reason,
         case when private.can_run_event(p_event) or (select private.my_role()) in ('physio', 'sporting_director') or x.reason <> 'injured'
              then x.detail else null end,
         x.until_date
  from private.eligibility_for(p_event, array(
         select pl.id from public.players pl
         where pl.group_id = any (private.event_group_ids(p_event)) and pl.is_active and pl.anonymized_at is null)) x
  where private.can_see_event(p_event) and (select private.my_role()) <> 'owner'
$$;

create or replace function public.save_match_squad(p_event uuid, p_formation text, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare v_blocked text; v_n int; v_status text; v_ids uuid[];
begin
  if not private.can_run_event(p_event) then raise exception 'Nu poți alege lotul la acest meci.' using errcode = '42501'; end if;
  select status into v_status from public.matches where event_id = p_event;
  if v_status is null then raise exception 'Evenimentul nu este un meci.'; end if;
  if v_status = 'finished' then raise exception 'Meciul este închis.'; end if;
  v_ids := array(select (r->>'player_id')::uuid from jsonb_array_elements(p_rows) r);
  if exists (select 1 from unnest(v_ids) i where not exists (
      select 1 from public.players pl where pl.id = i and pl.club_id = private.my_club() and pl.is_active)) then
    raise exception 'Jucător necunoscut.' using errcode = '42501';
  end if;
  select string_agg(distinct pl.display_name, ', ') into v_blocked
  from private.eligibility_for(p_event, v_ids) me join public.players pl on pl.id = me.player_id;
  if v_blocked is not null then raise exception 'Nu pot fi convocați: %.', v_blocked; end if;
  if (select count(*) from jsonb_array_elements(p_rows) r where r->>'role' = 'starter')
     > coalesce((select max(g.players_on_pitch) from public.groups g where g.id = any (private.event_group_ids(p_event))), 11) then
    raise exception 'Prea mulți titulari.';
  end if;
  delete from public.match_squad ms where ms.event_id = p_event and not (ms.player_id = any (v_ids));
  insert into public.match_squad (event_id, player_id, role, slot, is_captain)
  select p_event, (r->>'player_id')::uuid, r->>'role', nullif(r->>'slot', '')::smallint, coalesce((r->>'is_captain')::boolean, false)
  from jsonb_array_elements(p_rows) r
  on conflict (event_id, player_id) do update set role = excluded.role, slot = excluded.slot, is_captain = excluded.is_captain;
  get diagnostics v_n = row_count;
  update public.matches set formation = nullif(p_formation, '') where event_id = p_event;
  return v_n;
end $$;

create or replace function public.add_match_event(p_event uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_status text;
begin
  if not private.can_run_event(p_event) then raise exception 'Nu poți modifica acest meci.' using errcode = '42501'; end if;
  select status into v_status from public.matches where event_id = p_event;
  if v_status is null then raise exception 'Evenimentul nu este un meci.'; end if;
  if v_status = 'finished' then raise exception 'Meciul este închis.'; end if;
  if (p->>'kind') not in ('goal', 'opp_own_goal', 'own_goal', 'goal_against', 'yellow', 'red', 'sub') then raise exception 'Tip necunoscut.'; end if;
  if (p->>'kind') in ('goal', 'yellow', 'red', 'sub') and nullif(p->>'player_id', '') is null then
    raise exception 'Alege jucătorul.';
  end if;
  if (p->>'kind') = 'sub' and nullif(p->>'related_player_id', '') is null then raise exception 'Alege jucătorul care intră.'; end if;
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

-- ---------------------------------------------------------------------------
-- Închiderea și redeschiderea meciului
-- ---------------------------------------------------------------------------
alter table public.suspensions add column served_event_ids uuid[] not null default '{}';

create or replace function public.close_match(p_event uuid, p_ratings jsonb default '{}'::jsonb, p_report text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_m record; v_total int; v_comp record; r record; v_before int; v_now int; v_limit int;
begin
  if not private.can_run_event(p_event) then raise exception 'Nu poți închide acest meci.' using errcode = '42501'; end if;
  select m.*, e.club_id into v_m from public.matches m join public.events e on e.id = m.event_id where m.event_id = p_event;
  if v_m.event_id is null then raise exception 'Evenimentul nu este un meci.'; end if;
  if v_m.status = 'finished' then raise exception 'Meciul este deja închis.'; end if;
  select * into v_comp from public.competitions where id = v_m.competition_id;
  v_total := 2 * coalesce(v_comp.half_minutes,
    (select max(g.half_minutes) from public.groups g where g.id = any (private.event_group_ids(p_event))), 45);

  -- minute: titularii până la prima ieșire; rezervele de la intrare până la final sau la ieșire
  update public.match_squad ms set minutes = case
      when ms.role = 'starter' then least(v_total, coalesce((select min(e.minute) from public.match_events e
                                              where e.event_id = p_event and e.kind = 'sub' and e.player_id = ms.player_id), v_total))
      else coalesce(greatest(0,
             least(v_total, coalesce((select min(e.minute) from public.match_events e
                                      where e.event_id = p_event and e.kind = 'sub' and e.player_id = ms.player_id), v_total))
             - least(v_total, (select min(e.minute) from public.match_events e
                               where e.event_id = p_event and e.kind = 'sub' and e.related_player_id = ms.player_id))), 0)
    end
  where ms.event_id = p_event;

  -- note (doar pentru jucătorii din lot)
  insert into public.match_ratings (event_id, player_id, rating, rated_by)
  select p_event, k::uuid, greatest(1, least(5, (p_ratings->>k)::int)), app_auth.uid()
  from jsonb_object_keys(coalesce(p_ratings, '{}'::jsonb)) k
  where exists (select 1 from public.match_squad ms where ms.event_id = p_event and ms.player_id = k::uuid)
  on conflict (event_id, player_id) do update set rating = excluded.rating, rated_by = excluded.rated_by;

  if v_m.competition_id is not null then
    -- etapele ispășite: suspendații din aceeași competiție care nu au fost în lot
    update public.suspensions su set matches_remaining = matches_remaining - 1, served_event_ids = served_event_ids || p_event
    where su.club_id = v_m.club_id and su.matches_remaining > 0
      and (su.competition_id is null or su.competition_id = v_m.competition_id)
      and su.source_event_id is distinct from p_event
      and not (p_event = any (su.served_event_ids))
      and exists (select 1 from public.players pl where pl.id = su.player_id and pl.group_id = any (private.event_group_ids(p_event)))
      and not exists (select 1 from public.match_squad ms where ms.event_id = p_event and ms.player_id = su.player_id);

    -- suspendări noi, o dată pe jucător (amicalele nu suspendă)
    v_limit := coalesce(v_comp.yellow_limit, 3);
    for r in
      select e.player_id,
             count(*) filter (where e.kind = 'yellow') as yellows,
             count(*) filter (where e.kind = 'red') as reds
      from public.match_events e
      where e.event_id = p_event and e.kind in ('yellow', 'red') and e.player_id is not null
      group by e.player_id
    loop
      if r.reds > 0 or r.yellows >= 2 then
        insert into public.suspensions (club_id, player_id, competition_id, reason, source_event_id)
        values (v_m.club_id, r.player_id, v_m.competition_id, case when r.reds > 0 then 'Cartonaș roșu' else 'Două galbene în același meci' end, p_event);
      elsif r.yellows = 1 then
        select count(*) into v_now from public.match_events e2 join public.matches m2 on m2.event_id = e2.event_id
        where e2.player_id = r.player_id and e2.kind = 'yellow' and m2.competition_id = v_m.competition_id
          and (m2.status = 'finished' or m2.event_id = p_event);
        v_before := v_now - 1;
        if v_now / v_limit > v_before / v_limit then
          insert into public.suspensions (club_id, player_id, competition_id, reason, source_event_id)
          values (v_m.club_id, r.player_id, v_m.competition_id, v_now || ' cartonașe galbene', p_event);
        end if;
      end if;
    end loop;
  end if;

  update public.matches set status = 'finished', closed_at = now(), closed_by = app_auth.uid(),
    report = coalesce(nullif(p_report, ''), report)
  where event_id = p_event;
  update public.events set status = 'done' where id = p_event;
end $$;

create or replace function public.reopen_match(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (private.is_office() and private.event_club(p_event) = private.my_club()) then
    raise exception 'Doar biroul poate redeschide un meci.' using errcode = '42501';
  end if;
  delete from public.suspensions where source_event_id = p_event;
  update public.suspensions set matches_remaining = matches_remaining + 1, served_event_ids = array_remove(served_event_ids, p_event)
  where p_event = any (served_event_ids);
  update public.matches set status = 'live', closed_at = null, closed_by = null where event_id = p_event;
  update public.events set status = 'scheduled' where id = p_event;
end $$;

-- ---------------------------------------------------------------------------
-- Anulare / ștergere: antrenorul doar antrenamente și ședințe ale echipelor lui
-- ---------------------------------------------------------------------------
create or replace function public.set_event_state(p_event uuid, p_state text, p_scope text default 'one') returns int
language plpgsql security definer set search_path = '' as $$
declare v_ev record; v_n int; v_office boolean := private.is_office(); v_mine uuid[] := private.my_group_ids();
begin
  select * into v_ev from public.events where id = p_event;
  if not found or v_ev.club_id is distinct from private.my_club() then raise exception 'Eveniment necunoscut.' using errcode = '42501'; end if;
  if not v_office and not (
       private.my_role() = 'coach' and v_ev.kind in ('training', 'meeting')
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

-- ---------------------------------------------------------------------------
-- Numele echipelor: aceeași normalizare ca în browser (fără diacritice, fără punctuație)
-- ---------------------------------------------------------------------------
create or replace function private.norm_team(p text) returns text
language sql immutable set search_path = '' as $$
  select trim(regexp_replace(lower(public.unaccent_ro(coalesce(p, ''))), '[^a-z0-9]+', ' ', 'g'))
$$;

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
  v_own := private.norm_team(v_comp.own_name);
  if v_own = '' then raise exception 'Completează numele echipei noastre așa cum apare în lista federației.'; end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_start := nullif(r->>'starts_at', '')::timestamptz;
    if private.norm_team(r->>'home') like '%' || v_own || '%' then
      v_home := true; v_opp_name := trim(r->>'away');
    elsif private.norm_team(r->>'away') like '%' || v_own || '%' then
      v_home := false; v_opp_name := trim(r->>'home');
    else
      v_skipped := v_skipped + 1; continue;
    end if;
    if v_start is null or coalesce(v_opp_name, '') = '' then v_skipped := v_skipped + 1; continue; end if;

    insert into public.opponents (club_id, name) values (v_comp.club_id, v_opp_name)
    on conflict (club_id, name) do update set name = excluded.name returning id into v_opp;
    v_key := coalesce(r->>'round', '') || '|' || private.norm_team(v_opp_name) || '|' || case when v_home then 'h' else 'a' end;

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

create or replace function public.import_standings(p_competition uuid, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare v_comp record; v_own text; v_n int;
begin
  select * into v_comp from public.competitions where id = p_competition;
  if v_comp.id is null or v_comp.club_id <> private.my_club() or not private.is_office() then
    raise exception 'Nu poți importa în această competiție.' using errcode = '42501';
  end if;
  v_own := private.norm_team(v_comp.own_name);
  delete from public.competition_standings where competition_id = p_competition;
  insert into public.competition_standings (competition_id, position, team_name, played, won, drawn, lost, goals_for, goals_against, points, is_own)
  select p_competition, (r->>'position')::smallint, trim(r->>'team'), coalesce((r->>'played')::smallint, 0),
         coalesce((r->>'won')::smallint, 0), coalesce((r->>'drawn')::smallint, 0), coalesce((r->>'lost')::smallint, 0),
         coalesce((r->>'goals_for')::smallint, 0), coalesce((r->>'goals_against')::smallint, 0), coalesce((r->>'points')::smallint, 0),
         v_own <> '' and private.norm_team(r->>'team') like '%' || v_own || '%'
  from jsonb_array_elements(p_rows) r
  where nullif(r->>'position', '') is not null and nullif(trim(r->>'team'), '') is not null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;
revoke execute on function public.switch_membership(uuid), public.save_event(jsonb), public.set_event_state(uuid, text, text),
  public.match_eligibility(uuid), public.save_match_squad(uuid, text, jsonb), public.add_match_event(uuid, jsonb),
  public.close_match(uuid, jsonb, text), public.reopen_match(uuid), public.import_fixtures(uuid, jsonb, int),
  public.import_standings(uuid, jsonb) from public, anon;
grant execute on function public.switch_membership(uuid), public.save_event(jsonb), public.set_event_state(uuid, text, text),
  public.match_eligibility(uuid), public.save_match_squad(uuid, text, jsonb), public.add_match_event(uuid, jsonb),
  public.close_match(uuid, jsonb, text), public.reopen_match(uuid), public.import_fixtures(uuid, jsonb, int),
  public.import_standings(uuid, jsonb) to authenticated, service_role;
