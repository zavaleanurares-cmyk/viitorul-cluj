-- Locker Room · faza 3 · Bani: depozitul „finance" pentru facturi și specificațiile referatelor.
-- Calea: <club>/<…>; pentru referate: <club>/<utilizator>/<fișier>.
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

  elsif p_bucket = 'finance' then
    -- documentele financiare (facturi, specificații de referat): biroul financiar; autorul referatului își vede fișierul
    if v_owner is distinct from (select private.my_club()) then return false; end if;
    if (select private.is_finance()) then return true; end if;
    if p_action = 'read' then
      return exists (select 1 from public.purchase_requests r where r.spec_path = p_path)
          or exists (select 1 from public.expenses e where e.document_path = p_path);
    end if;
    -- un membru al staff-ului încarcă specificația propriului referat, într-un dosar al lui
    return p_action = 'write' and (select private.is_club_staff()) and split_part(p_path, '/', 2) = (select app_auth.uid())::text;

  elsif p_bucket = 'branding' then
    if v_owner is distinct from (select private.my_club()) then return false; end if;
    return p_action = 'read' or v_role = 'physio';
  end if;
  return false;
end $$;
