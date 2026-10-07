-- =============================================================================
-- 0006 · Corecții după primul val de module
--
-- 1. Antrenorul vede (doar citire) trimiterile către partenerul medical ale jucătorilor
--    din grupele lui; notele partenerului îi erau deja vizibile, dar fără trimitere nu
--    aveau de ce să se lege.
-- 2. Un document medical deja înregistrat nu mai poate fi suprascris prin încărcare:
--    calea ocupată se refuză (altfel partenerul ar fi putut înlocui un fișier al clubului).
-- =============================================================================

create policy referrals_select_medical on public.referrals for select to authenticated
  using (private.can_read_player_medical(player_id));

create or replace function private.medical_path_taken(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.medical_documents d where d.storage_path = p_path)
$$;
revoke execute on function private.medical_path_taken(text) from public;
grant execute on function private.medical_path_taken(text) to authenticated, service_role;

create or replace function public.file_access(p_bucket text, p_path text, p_action text)
returns boolean
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_owner uuid := private.try_uuid(split_part(p_path, '/', 1));
  v_role public.app_role := (select private.my_role());
begin
  if v_role is null or v_owner is null or p_path like '%..%' or p_action not in ('read', 'write', 'delete') then
    return false;
  end if;

  if p_bucket = 'medical' then
    if p_action = 'read' then
      -- vizibil doar dacă rândul din medical_documents este vizibil apelantului (RLS)
      return exists (select 1 from public.medical_documents d where d.storage_path = p_path);
    elsif p_action = 'write' then
      return (private.can_manage_player(v_owner) or private.partner_can_read_player(v_owner))
         and not private.medical_path_taken(p_path);
    else
      return private.can_manage_player(v_owner)
          or exists (select 1 from public.medical_documents d
                      where d.storage_path = p_path and d.uploaded_by = (select app_auth.uid())
                        and private.partner_can_read_player(v_owner));
    end if;

  elsif p_bucket = 'exercise-media' then
    if v_owner is distinct from (select private.my_club()) then return false; end if;
    if p_action = 'read' then
      return v_role in ('physio', 'coach', 'player', 'medical_partner');
    end if;
    return v_role = 'physio';

  elsif p_bucket = 'avatars' then
    if p_action = 'read' then
      return private.can_read_player_summary(v_owner);
    end if;
    return private.can_manage_player(v_owner) or private.is_self(v_owner);

  elsif p_bucket = 'branding' then
    if v_owner is distinct from (select private.my_club()) then return false; end if;
    return p_action = 'read' or v_role = 'physio';
  end if;
  return false;
end $$;
