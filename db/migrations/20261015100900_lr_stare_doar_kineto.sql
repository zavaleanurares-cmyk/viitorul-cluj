-- Locker Room faza 2: starea medicală a jucătorului (disponibil / accidentat, zona, data revenirii)
-- o schimbă doar preparatorul fizic. Biroul și directorul sportiv gestionează lotul (înscrieri, echipe,
-- date de contact), dar nu și starea. Conexiunile de serviciu (seed, scripturi) nu au rol și trec.
create or replace function private.players_status_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_role public.app_role := private.my_role();
begin
  if v_role is not null and v_role <> 'physio'
     and (new.status_id, new.status_note, new.status_zone, new.status_side, new.status_zone_detail,
          new.status_zone_uncertain, new.status_return_on)
         is distinct from
         (old.status_id, old.status_note, old.status_zone, old.status_side, old.status_zone_detail,
          old.status_zone_uncertain, old.status_return_on) then
    raise exception 'Starea medicală o schimbă doar preparatorul fizic.' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger players_status_guard before update on public.players
  for each row execute function private.players_status_guard();
