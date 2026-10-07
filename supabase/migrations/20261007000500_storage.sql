-- =============================================================================
-- 0005 · Storage: bucketuri private și politici
--   medical         : documente medicale  — cale: <player_id>/<fișier>
--   exercise-media  : clipuri de exerciții — cale: <club_id>/<fișier>
--   avatars         : fotografii jucători  — cale: <player_id>/<fișier>
--   branding        : sigla clubului       — cale: <club_id>/<fișier>
-- Toate sunt private; accesul se face doar prin linkuri semnate, cu expirare.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('medical', 'medical', false, 26214400,
     array['application/pdf','image/jpeg','image/png','image/webp','image/heic','application/dicom','application/zip']),
  ('exercise-media', 'exercise-media', false, 104857600,
     array['video/mp4','video/webm','video/quicktime','image/jpeg','image/png','image/webp','image/gif']),
  ('avatars', 'avatars', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('branding', 'branding', false, 2097152, array['image/png','image/svg+xml','image/webp','image/jpeg'])
on conflict (id) do nothing;

create or replace function private.try_uuid(p text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;
grant execute on function private.try_uuid(text) to authenticated, service_role;

-- medical ---------------------------------------------------------------------
-- Citirea este permisă doar dacă există un rând medical_documents vizibil apelantului (RLS).
create policy medical_read on storage.objects for select to authenticated
  using (bucket_id = 'medical'
     and exists (select 1 from public.medical_documents d where d.storage_path = name));
create policy medical_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'medical'
     and (private.can_manage_player(private.try_uuid((storage.foldername(name))[1]))
          or private.partner_can_read_player(private.try_uuid((storage.foldername(name))[1]))));
create policy medical_delete on storage.objects for delete to authenticated
  using (bucket_id = 'medical'
     and (private.can_manage_player(private.try_uuid((storage.foldername(name))[1]))
          or (owner_id = (select auth.uid())::text
              and private.partner_can_read_player(private.try_uuid((storage.foldername(name))[1])))));

-- exercise-media ----------------------------------------------------------------
create policy exercise_media_read on storage.objects for select to authenticated
  using (bucket_id = 'exercise-media'
     and private.try_uuid((storage.foldername(name))[1]) = (select private.my_club())
     and (select private.my_role()) in ('physio', 'coach', 'player', 'medical_partner'));
create policy exercise_media_write on storage.objects for insert to authenticated
  with check (bucket_id = 'exercise-media'
     and private.try_uuid((storage.foldername(name))[1]) = (select private.my_club())
     and (select private.is_physio()));
create policy exercise_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'exercise-media'
     and private.try_uuid((storage.foldername(name))[1]) = (select private.my_club())
     and (select private.is_physio()));

-- avatars -----------------------------------------------------------------------
create policy avatars_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars'
     and private.can_read_player_summary(private.try_uuid((storage.foldername(name))[1])));
create policy avatars_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars'
     and (private.can_manage_player(private.try_uuid((storage.foldername(name))[1]))
          or private.is_self(private.try_uuid((storage.foldername(name))[1]))));
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars'
     and (private.can_manage_player(private.try_uuid((storage.foldername(name))[1]))
          or private.is_self(private.try_uuid((storage.foldername(name))[1]))));
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars'
     and (private.can_manage_player(private.try_uuid((storage.foldername(name))[1]))
          or private.is_self(private.try_uuid((storage.foldername(name))[1]))));

-- branding ----------------------------------------------------------------------
create policy branding_read on storage.objects for select to authenticated
  using (bucket_id = 'branding'
     and private.try_uuid((storage.foldername(name))[1]) = (select private.my_club()));
create policy branding_write on storage.objects for insert to authenticated
  with check (bucket_id = 'branding'
     and private.try_uuid((storage.foldername(name))[1]) = (select private.my_club())
     and (select private.is_physio()));
create policy branding_update on storage.objects for update to authenticated
  using (bucket_id = 'branding'
     and private.try_uuid((storage.foldername(name))[1]) = (select private.my_club())
     and (select private.is_physio()));
create policy branding_delete on storage.objects for delete to authenticated
  using (bucket_id = 'branding'
     and private.try_uuid((storage.foldername(name))[1]) = (select private.my_club())
     and (select private.is_physio()));
