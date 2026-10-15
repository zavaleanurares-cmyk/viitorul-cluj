-- Locker Room · 7 · Directorul sportiv gestionează lotul (înscrieri, transferuri între echipe), ca biroul.
create policy players_write_director on public.players for all to authenticated
  using (club_id = (select private.my_club()) and (select private.my_role()) = 'sporting_director')
  with check (club_id = (select private.my_club()) and (select private.my_role()) = 'sporting_director');
