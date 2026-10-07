-- =============================================================================
-- 0005 · Fișiere: cine are voie să citească / scrie / șteargă
--
-- Fișierele stau într-un depozit privat (Vercel Blob), sub calea `<bucket>/<cale>`:
--   medical/<player_id>/<fișier>          documente medicale
--   exercise-media/<club_id>/<fișier>     clipuri de exerciții
--   avatars/<player_id>/<fișier>          fotografii jucători
--   branding/<club_id>/<fișier>           sigla clubului
-- Nu există adrese publice: aplicația servește fișierul doar după ce această funcție,
-- apelată cu identitatea utilizatorului (RLS activ), răspunde „da".
-- =============================================================================

create or replace function private.try_uuid(p text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

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
      return private.can_manage_player(v_owner) or private.partner_can_read_player(v_owner);
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

revoke execute on function public.file_access(text, text, text) from public, anon;
grant execute on function public.file_access(text, text, text) to authenticated, service_role;
revoke execute on function private.try_uuid(text) from public;
grant execute on function private.try_uuid(text) to authenticated, service_role;
