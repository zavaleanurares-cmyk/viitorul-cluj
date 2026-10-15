-- Patronul aprobă referate și vede primele: are nevoie de numele staff-ului (altfel apare „Cerut de —").
drop policy if exists profiles_staff_directory on public.profiles;
create policy profiles_staff_directory on public.profiles for select to authenticated
  using (club_id = (select private.my_club())
     and (select private.my_role()) in ('admin', 'secretary', 'sporting_director', 'physio', 'coach', 'accountant', 'owner')
     and role in ('admin', 'secretary', 'sporting_director', 'physio', 'coach', 'accountant', 'owner'));
