-- Locker Room · faza 3 · Bani: codul de plată se recunoaște oricare ar fi prefixul (și după o schimbare de prefix
-- în setări, codurile deja date rămân valabile). „LR 1042", „lr-1042", „LR1042" → LR-1042.
create or replace function private.guardian_by_ref(p_club uuid, p_text text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_norm text;
begin
  if p_text is null then return null; end if;
  v_norm := ' ' || regexp_replace(upper(p_text), '([A-Z]{2,6})[\s\-_./]*([0-9]{4,6})', '\1-\2', 'g') || ' ';
  return (
    select g.id from public.guardians g
    where g.club_id = p_club and g.deleted_at is null and g.payment_ref is not null
      and v_norm ~ ('[^A-Z0-9]' || g.payment_ref || '[^0-9]')
    order by length(g.payment_ref) desc, g.created_at
    limit 1);
end $$;
