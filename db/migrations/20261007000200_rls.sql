-- =============================================================================
-- 0002 · Funcții de autorizare + Row Level Security
--
-- Principii:
--   * totul este interzis implicit; fiecare tabel are RLS activ;
--   * rolul `anon` nu are niciun drept;
--   * funcțiile ajutătoare stau în schema `private` (neexpusă prin API) și sunt
--     SECURITY DEFINER ca să poată citi profiles/players fără recursivitate RLS;
--   * antrenorul are doar SELECT, strict pe grupele lui;
--   * patronul nu are acces la rânduri individuale: vede doar agregate, prin RPC.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Cine sunt eu
-- ---------------------------------------------------------------------------
create or replace function private.my_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p
  where p.id = (select app_auth.uid()) and p.is_active
$$;

create or replace function private.my_club() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.club_id from public.profiles p
  where p.id = (select app_auth.uid()) and p.is_active
$$;

create or replace function private.my_group_ids() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(sg.group_id), '{}'::uuid[])
  from public.staff_groups sg
  join public.profiles p on p.id = sg.user_id and p.is_active
  where sg.user_id = (select app_auth.uid())
$$;

create or replace function private.is_physio() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.my_role()) = 'physio', false)
$$;

-- Ziua curentă în fusul orar al clubului (implicit Europe/Bucharest).
create or replace function private.club_today(p_club uuid default null) returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce(
    (select c.settings->>'timezone' from public.clubs c
      where c.id = coalesce(p_club, (select private.my_club()))),
    'Europe/Bucharest'))::date
$$;

-- ---------------------------------------------------------------------------
-- Ce am voie cu un jucător
-- ---------------------------------------------------------------------------
-- Preparatorul fizic al clubului jucătorului.
create or replace function private.can_manage_player(p_player uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.players pl
    where pl.id = p_player
      and pl.club_id = (select private.my_club())
      and (select private.my_role()) = 'physio'
  )
$$;

-- Jucătorul însuși.
create or replace function private.is_self(p_player uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.players pl
    where pl.id = p_player
      and pl.user_id = (select app_auth.uid())
      and pl.club_id = (select private.my_club())
  )
$$;

-- Fișa medicală completă: preparator, antrenorul grupei curente a jucătorului, jucătorul.
create or replace function private.can_read_player_medical(p_player uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.players pl
    where pl.id = p_player
      and pl.club_id = (select private.my_club())
      and (
        (select private.my_role()) = 'physio'
        or ((select private.my_role()) = 'coach'
            and pl.group_id is not null
            and pl.group_id = any ((select private.my_group_ids())::uuid[]))
        or pl.user_id = (select app_auth.uid())
      )
  )
$$;

-- Fișa sumară: cei de mai sus + directorul sportiv.
create or replace function private.can_read_player_summary(p_player uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_read_player_medical(p_player)
      or exists (
        select 1 from public.players pl
        where pl.id = p_player
          and pl.club_id = (select private.my_club())
          and (select private.my_role()) = 'sporting_director'
      )
$$;

-- Partenerul medical: doar jucătorii trimiși explicit către el (trimitere activă).
create or replace function private.partner_can_read_player(p_player uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.my_role()) = 'medical_partner'
     and exists (
       select 1 from public.referrals r
       join public.players pl on pl.id = r.player_id
       where r.player_id = p_player
         and r.partner_user_id = (select app_auth.uid())
         and r.is_active
         and pl.club_id = (select private.my_club())
     )
$$;

-- Partenerul vede accidentarea trimisă; dacă trimiterea nu indică una anume, vede toate accidentările jucătorului.
create or replace function private.partner_can_read_injury(p_injury uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.my_role()) = 'medical_partner'
     and exists (
       select 1 from public.injuries i
       join public.referrals r on r.player_id = i.player_id
       join public.players pl on pl.id = i.player_id
       where i.id = p_injury
         and r.partner_user_id = (select app_auth.uid())
         and r.is_active
         and pl.club_id = (select private.my_club())
         and (r.injury_id is null or r.injury_id = i.id)
     )
$$;

create or replace function private.can_read_injury(p_injury uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.injuries i
    where i.id = p_injury and private.can_read_player_medical(i.player_id)
  ) or private.partner_can_read_injury(p_injury)
$$;

create or replace function private.can_manage_injury(p_injury uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.injuries i
    where i.id = p_injury and private.can_manage_player(i.player_id)
  )
$$;

create or replace function private.partner_can_read_document(p_player uuid, p_injury uuid, p_uploaded_by uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.my_role()) = 'medical_partner'
     and exists (
       select 1 from public.referrals r
       join public.players pl on pl.id = r.player_id
       where r.player_id = p_player
         and r.partner_user_id = (select app_auth.uid())
         and r.is_active
         and pl.club_id = (select private.my_club())
         and (r.injury_id is null or r.injury_id = p_injury or p_uploaded_by = (select app_auth.uid()))
     )
$$;

create or replace function private.referral_player(p_referral uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select r.player_id from public.referrals r where r.id = p_referral
$$;

create or replace function private.is_my_active_referral(p_referral uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.my_role()) = 'medical_partner'
     and exists (
       select 1 from public.referrals r
       join public.players pl on pl.id = r.player_id
       where r.id = p_referral and r.is_active
         and r.partner_user_id = (select app_auth.uid())
         and pl.club_id = (select private.my_club())
     )
$$;

create or replace function private.plan_player(p_plan uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select dp.player_id from public.daily_plans dp where dp.id = p_plan
$$;

create or replace function private.program_club(p_program uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select pr.club_id from public.programs pr where pr.id = p_program
$$;

create or replace function private.assignment_club(p_assignment uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select a.club_id from public.program_assignments a where a.id = p_assignment
$$;

create or replace function private.player_in_assignment(p_assignment uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.program_assignment_players ap
    join public.players pl on pl.id = ap.player_id
    where ap.assignment_id = p_assignment
      and pl.user_id = (select app_auth.uid())
      and pl.club_id = (select private.my_club())
  )
$$;

create or replace function private.group_club(p_group uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select g.club_id from public.groups g where g.id = p_group
$$;

create or replace function private.profile_club(p_user uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.club_id from public.profiles p where p.id = p_user
$$;

create or replace function private.test_club(p_test uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select t.club_id from public.fitness_tests t where t.id = p_test
$$;

create or replace function private.session_club(p_session uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select s.club_id from public.physical_sessions s where s.id = p_session
$$;

revoke execute on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Drepturi de tabel: nimic pentru anon; authenticated trece prin RLS.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, public;
revoke all on all sequences in schema public from anon, public;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Jurnalul de audit: doar citire prin API (scrierea se face din triggere / RPC).
revoke insert, update, delete on public.audit_log from authenticated;
-- Notificări: utilizatorul poate schimba doar `read_at`.
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
-- Alerte: preparatorul poate doar să le închidă.
revoke insert, update on public.alerts from authenticated;
grant update (resolved_at, resolved_by) on public.alerts to authenticated;
-- Istoricul de stare și de grupă se scrie doar din triggere.
revoke insert, update, delete on public.status_history from authenticated;
revoke insert, update, delete on public.player_group_history from authenticated;

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Politici
-- ---------------------------------------------------------------------------

-- clubs ----------------------------------------------------------------------
create policy clubs_select on public.clubs for select to authenticated
  using (id = (select private.my_club()));
create policy clubs_update on public.clubs for update to authenticated
  using (id = (select private.my_club()) and (select private.is_physio()))
  with check (id = (select private.my_club()) and (select private.is_physio()));

-- club_statuses --------------------------------------------------------------
create policy club_statuses_select on public.club_statuses for select to authenticated
  using (club_id = (select private.my_club()));
create policy club_statuses_write on public.club_statuses for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_physio()))
  with check (club_id = (select private.my_club()) and (select private.is_physio()));

-- groups ---------------------------------------------------------------------
create policy groups_select on public.groups for select to authenticated
  using (club_id = (select private.my_club()));
create policy groups_write on public.groups for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_physio()))
  with check (club_id = (select private.my_club()) and (select private.is_physio()));

-- profiles -------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select app_auth.uid())
      or (club_id = (select private.my_club()) and (select private.is_physio())));
create policy profiles_write on public.profiles for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_physio()))
  with check (club_id = (select private.my_club()) and (select private.is_physio()));

-- staff_groups ---------------------------------------------------------------
create policy staff_groups_select on public.staff_groups for select to authenticated
  using (user_id = (select app_auth.uid())
      or (private.group_club(group_id) = (select private.my_club()) and (select private.is_physio())));
create policy staff_groups_write on public.staff_groups for all to authenticated
  using (private.group_club(group_id) = (select private.my_club()) and (select private.is_physio()))
  with check (private.group_club(group_id) = (select private.my_club())
          and private.profile_club(user_id) = (select private.my_club())
          and (select private.is_physio()));

-- players --------------------------------------------------------------------
create policy players_select on public.players for select to authenticated
  using (
    club_id = (select private.my_club())
    and (
      (select private.my_role()) in ('physio', 'sporting_director')
      or ((select private.my_role()) = 'coach' and group_id is not null
          and group_id = any ((select private.my_group_ids())::uuid[]))
      or user_id = (select app_auth.uid())
      or private.partner_can_read_player(id)
    )
  );
create policy players_write on public.players for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_physio()))
  with check (club_id = (select private.my_club()) and (select private.is_physio()));

-- player_contacts ------------------------------------------------------------
create policy player_contacts_select on public.player_contacts for select to authenticated
  using (private.can_manage_player(player_id) or private.is_self(player_id));
create policy player_contacts_insert on public.player_contacts for insert to authenticated
  with check (private.can_manage_player(player_id) or private.is_self(player_id));
create policy player_contacts_update on public.player_contacts for update to authenticated
  using (private.can_manage_player(player_id) or private.is_self(player_id))
  with check (private.can_manage_player(player_id) or private.is_self(player_id));
create policy player_contacts_delete on public.player_contacts for delete to authenticated
  using (private.can_manage_player(player_id));

-- istoric de grupă / stare ---------------------------------------------------
create policy player_group_history_select on public.player_group_history for select to authenticated
  using (private.can_read_player_medical(player_id));
create policy status_history_select on public.status_history for select to authenticated
  using (private.can_read_player_summary(player_id));

-- anthropometrics ------------------------------------------------------------
create policy anthropometrics_select on public.anthropometrics for select to authenticated
  using (private.can_read_player_medical(player_id));
create policy anthropometrics_write on public.anthropometrics for all to authenticated
  using (private.can_manage_player(player_id))
  with check (private.can_manage_player(player_id));

-- injuries -------------------------------------------------------------------
create policy injuries_select on public.injuries for select to authenticated
  using (private.can_read_player_medical(player_id) or private.partner_can_read_injury(id));
create policy injuries_write on public.injuries for all to authenticated
  using (private.can_manage_player(player_id))
  with check (private.can_manage_player(player_id));

-- injury_treatments ----------------------------------------------------------
create policy injury_treatments_select on public.injury_treatments for select to authenticated
  using (private.can_read_injury(injury_id));
create policy injury_treatments_write on public.injury_treatments for all to authenticated
  using (private.can_manage_injury(injury_id))
  with check (private.can_manage_injury(injury_id));

-- medical_documents ----------------------------------------------------------
create policy medical_documents_select on public.medical_documents for select to authenticated
  using (private.can_read_player_medical(player_id)
      or private.partner_can_read_document(player_id, injury_id, uploaded_by));
create policy medical_documents_insert on public.medical_documents for insert to authenticated
  with check (
    private.can_manage_player(player_id)
    or (uploaded_by = (select app_auth.uid())
        and private.partner_can_read_document(player_id, injury_id, uploaded_by))
  );
create policy medical_documents_update on public.medical_documents for update to authenticated
  using (private.can_manage_player(player_id))
  with check (private.can_manage_player(player_id));
create policy medical_documents_delete on public.medical_documents for delete to authenticated
  using (private.can_manage_player(player_id)
      or (uploaded_by = (select app_auth.uid()) and private.partner_can_read_player(player_id)));

-- referrals ------------------------------------------------------------------
create policy referrals_select on public.referrals for select to authenticated
  using (private.can_manage_player(player_id)
      or private.is_self(player_id)
      or (partner_user_id = (select app_auth.uid()) and (select private.my_role()) = 'medical_partner'));
create policy referrals_write on public.referrals for all to authenticated
  using (private.can_manage_player(player_id))
  with check (private.can_manage_player(player_id)
          and private.profile_club(partner_user_id) = (select private.my_club()));

-- partner_notes --------------------------------------------------------------
create policy partner_notes_select on public.partner_notes for select to authenticated
  using (private.can_read_player_medical(private.referral_player(referral_id))
      or private.is_my_active_referral(referral_id));
create policy partner_notes_insert on public.partner_notes for insert to authenticated
  with check (author_id = (select app_auth.uid())
          and (private.is_my_active_referral(referral_id)
               or private.can_manage_player(private.referral_player(referral_id))));
create policy partner_notes_delete on public.partner_notes for delete to authenticated
  using (private.can_manage_player(private.referral_player(referral_id))
      or (author_id = (select app_auth.uid()) and private.is_my_active_referral(referral_id)));

-- exercises ------------------------------------------------------------------
create policy exercises_select on public.exercises for select to authenticated
  using (club_id = (select private.my_club())
     and (select private.my_role()) in ('physio', 'coach', 'player', 'medical_partner'));
create policy exercises_write on public.exercises for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_physio()))
  with check (club_id = (select private.my_club()) and (select private.is_physio()));

-- programs / program_exercises -----------------------------------------------
create policy programs_select on public.programs for select to authenticated
  using (club_id = (select private.my_club())
     and (select private.my_role()) in ('physio', 'player'));
create policy programs_write on public.programs for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_physio()))
  with check (club_id = (select private.my_club()) and (select private.is_physio()));

create policy program_exercises_select on public.program_exercises for select to authenticated
  using (private.program_club(program_id) = (select private.my_club())
     and (select private.my_role()) in ('physio', 'player'));
create policy program_exercises_write on public.program_exercises for all to authenticated
  using (private.program_club(program_id) = (select private.my_club()) and (select private.is_physio()))
  with check (private.program_club(program_id) = (select private.my_club()) and (select private.is_physio()));

-- program_assignments (+ players) ---------------------------------------------
create policy program_assignments_select on public.program_assignments for select to authenticated
  using ((club_id = (select private.my_club()) and (select private.is_physio()))
      or private.player_in_assignment(id));
create policy program_assignments_write on public.program_assignments for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_physio()))
  with check (club_id = (select private.my_club()) and (select private.is_physio())
          and private.program_club(program_id) = (select private.my_club()));

create policy pap_select on public.program_assignment_players for select to authenticated
  using (private.can_manage_player(player_id) or private.is_self(player_id));
create policy pap_write on public.program_assignment_players for all to authenticated
  using (private.can_manage_player(player_id))
  with check (private.can_manage_player(player_id)
          and private.assignment_club(assignment_id) = (select private.my_club()));

-- daily_plans (+ items) --------------------------------------------------------
create policy daily_plans_select on public.daily_plans for select to authenticated
  using (private.can_manage_player(player_id) or private.is_self(player_id));
create policy daily_plans_write on public.daily_plans for all to authenticated
  using (private.can_manage_player(player_id))
  with check (private.can_manage_player(player_id));

create policy daily_plan_items_select on public.daily_plan_items for select to authenticated
  using (private.can_manage_player(private.plan_player(plan_id))
      or private.is_self(private.plan_player(plan_id)));
create policy daily_plan_items_write on public.daily_plan_items for all to authenticated
  using (private.can_manage_player(private.plan_player(plan_id)))
  with check (private.can_manage_player(private.plan_player(plan_id)));

-- exercise_completions ---------------------------------------------------------
create policy exercise_completions_select on public.exercise_completions for select to authenticated
  using (private.can_manage_player(player_id) or private.is_self(player_id));
create policy exercise_completions_insert on public.exercise_completions for insert to authenticated
  with check (
    private.can_manage_player(player_id)
    or (private.is_self(player_id)
        and done_on between (select private.club_today()) - 2 and (select private.club_today()))
  );
create policy exercise_completions_update on public.exercise_completions for update to authenticated
  using (private.can_manage_player(player_id)
      or (private.is_self(player_id) and done_on >= (select private.club_today()) - 2))
  with check (private.can_manage_player(player_id)
      or (private.is_self(player_id)
          and done_on between (select private.club_today()) - 2 and (select private.club_today())));
create policy exercise_completions_delete on public.exercise_completions for delete to authenticated
  using (private.can_manage_player(player_id)
      or (private.is_self(player_id) and done_on >= (select private.club_today()) - 2));

-- wellness_entries -------------------------------------------------------------
create policy wellness_select on public.wellness_entries for select to authenticated
  using (private.can_read_player_medical(player_id));
create policy wellness_insert on public.wellness_entries for insert to authenticated
  with check (
    private.can_manage_player(player_id)
    or (private.is_self(player_id)
        and entry_date = (select private.club_today())
        and source = 'app' and not needs_review)
  );
create policy wellness_update on public.wellness_entries for update to authenticated
  using (private.can_manage_player(player_id)
      or (private.is_self(player_id) and entry_date = (select private.club_today())))
  with check (private.can_manage_player(player_id)
      or (private.is_self(player_id)
          and entry_date = (select private.club_today())
          and source = 'app' and not needs_review));
create policy wellness_delete on public.wellness_entries for delete to authenticated
  using (private.can_manage_player(player_id));

-- rpe_entries --------------------------------------------------------------------
create policy rpe_select on public.rpe_entries for select to authenticated
  using (private.can_read_player_medical(player_id));
create policy rpe_insert on public.rpe_entries for insert to authenticated
  with check (
    private.can_manage_player(player_id)
    or (private.is_self(player_id)
        and entry_date between (select private.club_today()) - 1 and (select private.club_today()))
  );
create policy rpe_update on public.rpe_entries for update to authenticated
  using (private.can_manage_player(player_id)
      or (private.is_self(player_id) and entry_date >= (select private.club_today()) - 1))
  with check (private.can_manage_player(player_id)
      or (private.is_self(player_id)
          and entry_date between (select private.club_today()) - 1 and (select private.club_today())));
create policy rpe_delete on public.rpe_entries for delete to authenticated
  using (private.can_manage_player(player_id));

-- date fizice --------------------------------------------------------------------
create policy physical_sessions_select on public.physical_sessions for select to authenticated
  using (club_id = (select private.my_club())
     and ((select private.my_role()) in ('physio', 'player')
          or ((select private.my_role()) = 'coach'
              and (group_id is null or group_id = any ((select private.my_group_ids())::uuid[])))));
create policy physical_sessions_write on public.physical_sessions for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_physio()))
  with check (club_id = (select private.my_club()) and (select private.is_physio()));

create policy physical_metrics_select on public.physical_metrics for select to authenticated
  using (private.can_read_player_medical(player_id));
create policy physical_metrics_write on public.physical_metrics for all to authenticated
  using (private.can_manage_player(player_id))
  with check (private.can_manage_player(player_id)
          and private.session_club(session_id) = (select private.my_club()));

create policy fitness_tests_select on public.fitness_tests for select to authenticated
  using (club_id = (select private.my_club()));
create policy fitness_tests_write on public.fitness_tests for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_physio()))
  with check (club_id = (select private.my_club()) and (select private.is_physio()));

create policy fitness_test_results_select on public.fitness_test_results for select to authenticated
  using (private.can_read_player_medical(player_id));
create policy fitness_test_results_write on public.fitness_test_results for all to authenticated
  using (private.can_manage_player(player_id))
  with check (private.can_manage_player(player_id)
          and private.test_club(test_id) = (select private.my_club()));

-- alerts -------------------------------------------------------------------------
create policy alerts_select on public.alerts for select to authenticated
  using (club_id = (select private.my_club()) and (select private.is_physio()));
create policy alerts_update on public.alerts for update to authenticated
  using (club_id = (select private.my_club()) and (select private.is_physio()))
  with check (club_id = (select private.my_club()) and (select private.is_physio()));
create policy alerts_delete on public.alerts for delete to authenticated
  using (club_id = (select private.my_club()) and (select private.is_physio()));

-- notifications / push_tokens -------------------------------------------------------
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select app_auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select app_auth.uid())) with check (user_id = (select app_auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select app_auth.uid()));

create policy push_tokens_all on public.push_tokens for all to authenticated
  using (user_id = (select app_auth.uid())) with check (user_id = (select app_auth.uid()));

-- importuri ------------------------------------------------------------------------
create policy imports_all on public.imports for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_physio()))
  with check (club_id = (select private.my_club()) and (select private.is_physio()));
create policy import_templates_all on public.import_templates for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_physio()))
  with check (club_id = (select private.my_club()) and (select private.is_physio()));
create policy name_matches_all on public.name_matches for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_physio()))
  with check (club_id = (select private.my_club()) and (select private.is_physio()));

-- consents -------------------------------------------------------------------------
create policy consents_select on public.consents for select to authenticated
  using (
    user_id = (select app_auth.uid())
    or (player_id is not null and (private.is_self(player_id) or private.can_manage_player(player_id)))
    or (user_id is not null and (select private.is_physio())
        and private.profile_club(user_id) = (select private.my_club()))
  );
create policy consents_insert on public.consents for insert to authenticated
  with check (
    -- consimțământ propriu (sau al tutorelui, dat pe ecran, pentru propriul cont)
    (user_id = (select app_auth.uid())
       and kind in ('self', 'guardian_digital', 'staff_confidentiality')
       and (player_id is null or private.is_self(player_id))
       and recorded_by is null and withdrawn_at is null)
    -- acord pe hârtie înregistrat de preparator
    or (player_id is not null and private.can_manage_player(player_id)
        and kind = 'guardian_paper' and recorded_by = (select app_auth.uid()))
  );
create policy consents_update on public.consents for update to authenticated
  using (user_id = (select app_auth.uid())
      or (player_id is not null and private.can_manage_player(player_id)))
  with check (user_id = (select app_auth.uid())
      or (player_id is not null and private.can_manage_player(player_id)));

-- data_requests ----------------------------------------------------------------------
create policy data_requests_select on public.data_requests for select to authenticated
  using (user_id = (select app_auth.uid())
      or (club_id = (select private.my_club()) and (select private.is_physio())));
create policy data_requests_insert on public.data_requests for insert to authenticated
  with check (user_id = (select app_auth.uid())
          and club_id = (select private.my_club())
          and status = 'open' and handled_by is null
          and (player_id is null or private.is_self(player_id)));
create policy data_requests_update on public.data_requests for update to authenticated
  using (club_id = (select private.my_club()) and (select private.is_physio()))
  with check (club_id = (select private.my_club()) and (select private.is_physio()));

-- audit_log --------------------------------------------------------------------------
create policy audit_log_select on public.audit_log for select to authenticated
  using (club_id = (select private.my_club()) and (select private.is_physio()));

-- Consimțământ: prin API se poate modifica doar retragerea.
revoke update on public.consents from authenticated;
grant update (withdrawn_at) on public.consents to authenticated;
