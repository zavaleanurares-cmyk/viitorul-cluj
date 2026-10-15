-- Locker Room faza 4 · Greutate: grila pe echipă (o măsurătoare pe jucător și zi), salvată atomic.
-- Rulează cu drepturile utilizatorului (RLS: doar preparatorul scrie).
--   p_rows = [{ player_id, weight_kg?, height_cm?, body_fat_pct? }]; un rând fără nicio valoare șterge măsurătoarea zilei.
create or replace function public.save_body_measurements(p_date date, p_rows jsonb) returns int
language plpgsql security invoker set search_path = '' as $$
declare r jsonb; v_id uuid; v_n int := 0; v_w numeric; v_h numeric; v_f numeric;
begin
  if p_date is null or p_date > private.club_today() then
    raise exception 'Data măsurătorii nu poate fi în viitor.' using errcode = '22023';
  end if;
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    -- RLS ar ignora în tăcere o modificare nepermisă; refuzăm explicit
    if not private.can_manage_player((r->>'player_id')::uuid) then
      raise exception 'Doar preparatorul fizic introduce măsurătorile.' using errcode = '42501';
    end if;
    v_w := nullif(r->>'weight_kg', '')::numeric;
    v_h := nullif(r->>'height_cm', '')::numeric;
    v_f := nullif(r->>'body_fat_pct', '')::numeric;
    select a.id into v_id from public.anthropometrics a
    where a.player_id = (r->>'player_id')::uuid and a.measured_on = p_date
    order by a.created_at desc limit 1;
    if v_w is null and v_h is null and v_f is null then
      if v_id is not null then delete from public.anthropometrics where id = v_id; v_n := v_n + 1; end if;
      continue;
    end if;
    if v_id is null then
      insert into public.anthropometrics (player_id, measured_on, weight_kg, height_cm, body_fat_pct, created_by)
      values ((r->>'player_id')::uuid, p_date, v_w, v_h, v_f, app_auth.uid());
    else
      update public.anthropometrics set weight_kg = v_w, height_cm = v_h, body_fat_pct = v_f where id = v_id;
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
grant execute on function public.save_body_measurements(date, jsonb) to authenticated;
