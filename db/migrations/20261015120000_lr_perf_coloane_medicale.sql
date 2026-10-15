-- Locker Room faza 4: detaliile medicale de pe rândul jucătorului (nota stării, zona, restricțiile,
-- nota de verificare) nu mai ajung la birou (administrator, secretariat, contabil), la patron sau la părinți.
--
-- RLS filtrează rânduri, nu coloane. De aceea cererile rulează sub unul din două roluri Postgres:
--   authenticated  — toată lumea; vede rândul jucătorului fără coloanele medicale;
--   lr_health      — moștenește authenticated și primește în plus coloanele medicale.
-- Rolul se alege la începutul fiecărei tranzacții din rolul utilizatorului în clubul curent
-- (`private.db_role_for`). RLS rămâne neschimbat: lr_health trece prin aceleași politici.
--
-- Atenție la migrările viitoare: o coloană nouă pe `players` trebuie dată explicit lui authenticated
-- (`grant select (col), insert (col), update (col) on public.players to authenticated`).
-- Testul de acces verifică asta.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'lr_health') then
    create role lr_health nologin inherit;
  end if;
  grant authenticated to lr_health;
  begin
    execute format('grant lr_health to %I', current_user);
  exception when others then
    raise notice 'grant lr_health către %: %', current_user, sqlerrm;
  end;
end $$;

-- Rolurile care văd detaliile medicale (aceleași ca în packages/shared/src/roles.ts → HEALTH_DB_ROLES).
create or replace function private.db_role_for(p_uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case when p.role in ('physio', 'coach', 'sporting_director', 'player', 'medical_partner')
                then 'lr_health' else 'authenticated' end
    from public.profiles p where p.id = p_uid and p.is_active), 'authenticated')
$$;
revoke all on function private.db_role_for(uuid) from public, authenticated, anon;

/** Pentru funcțiile care rulează ca proprietar (security definer): poate cititorul vedea detaliile medicale? */
create or replace function private.can_read_health() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.db_role_for(app_auth.uid()) = 'lr_health' or app_auth.role() = 'service_role'
$$;
grant execute on function private.can_read_health() to authenticated;

do $$
declare
  v_sensitive text[] := array['status_note', 'status_zone', 'status_side', 'status_zone_detail',
                              'status_zone_uncertain', 'training_restrictions', 'review_note'];
  v_cols text;
  v_sens text;
begin
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into v_cols
  from pg_attribute a
  where a.attrelid = 'public.players'::regclass and a.attnum > 0 and not a.attisdropped
    and a.attname <> all (v_sensitive);
  select string_agg(quote_ident(s), ', ') into v_sens from unnest(v_sensitive) s;

  revoke select, insert, update on public.players from authenticated;
  execute format('grant select (%s), insert (%s), update (%s) on public.players to authenticated', v_cols, v_cols, v_cols);
  execute format('grant select (%s), insert (%s), update (%s) on public.players to lr_health', v_sens, v_sens, v_sens);
end $$;

grant usage on schema public, private, app_auth to lr_health;

-- La meci, biroul vede doar eticheta stării („Accidentat"), nu nota medicală.
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
  select r.id, 'injured', case when private.can_read_health() then coalesce(nullif(r.status_note, ''), s.label) else s.label end, r.status_return_on
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
