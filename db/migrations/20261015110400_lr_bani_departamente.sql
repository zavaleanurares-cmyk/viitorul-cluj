-- Locker Room · faza 3 · Bani: politica departamentelor fără recursivitate.
create or replace function private.department_club(p_department uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select d.club_id from public.departments d where d.id = p_department
$$;
revoke execute on function private.department_club(uuid) from public;
grant execute on function private.department_club(uuid) to authenticated, service_role;

drop policy departments_write on public.departments;
create policy departments_write on public.departments for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_finance()))
  with check (club_id = (select private.my_club()) and (select private.is_finance())
    and (parent_id is null or private.department_club(parent_id) = club_id));
