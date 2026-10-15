-- Locker Room · 5 · Numele cluburilor în care am un rol (pentru alegerea clubului curent).
create policy clubs_select_member on public.clubs for select to authenticated
  using (exists (select 1 from public.memberships m
                 where m.club_id = clubs.id and m.user_id = (select app_auth.uid()) and m.is_active));
