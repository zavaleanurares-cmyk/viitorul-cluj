-- Partajarea unei înregistrări cu alte echipe (ca „Partajează cu altă echipă" din TFB):
-- antrenorii echipelor alese o văd și îi văd clipurile, dar nu o pot modifica, partaja mai departe sau șterge.

alter table public.videos add column shared_group_ids uuid[] not null default '{}';

/** Înregistrarea e partajată cu una dintre echipele mele (antrenor). */
create or replace function private.video_shared_with_me(p_club uuid, p_shared uuid[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_club = private.my_club() and private.my_role() = 'coach' and cardinality(p_shared) > 0
     and p_shared && private.my_group_ids()
$$;
/** Pot privi înregistrarea: o am în grijă (can_see_video) sau mi-a fost partajată. */
create or replace function private.can_view_video(p_video uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.can_see_video_row(v.club_id, v.group_id) or private.video_shared_with_me(v.club_id, v.shared_group_ids)
                   from public.videos v where v.id = p_video), false)
$$;
revoke all on function private.video_shared_with_me(uuid, uuid[]), private.can_view_video(uuid) from public;
grant execute on function private.video_shared_with_me(uuid, uuid[]), private.can_view_video(uuid) to authenticated;

-- citirea se extinde la echipele cu care s-a partajat; scrierea rămâne neschimbată (videos_write, video_markers_write)
drop policy videos_select on public.videos;
create policy videos_select on public.videos for select to authenticated
  using (private.can_see_video_row(club_id, group_id) or private.video_shared_with_me(club_id, shared_group_ids));
drop policy video_markers_select on public.video_markers;
create policy video_markers_select on public.video_markers for select to authenticated
  using (private.can_view_video(video_id) or private.can_see_shared_marker(id));
drop policy video_marker_players_select on public.video_marker_players;
create policy video_marker_players_select on public.video_marker_players for select to authenticated
  using (exists (select 1 from public.video_markers m where m.id = marker_id and private.can_view_video(m.video_id))
         or (player_id = any ((select private.my_player_ids())::uuid[]) and private.can_see_shared_marker(marker_id)));

-- fișierul: îl citesc și echipele cu care s-a partajat (rândul e vizibil), dar îl șterge doar cine are înregistrarea în grijă
do $$
declare v_src text; v_old text := E'    end if;\n    return exists (select 1 from public.videos v where v.storage_path = p_path);\n  elsif p_bucket = ''contracts''';
begin
  select pg_get_functiondef('private.file_access_lr(text, text, text, uuid, public.app_role)'::regprocedure) into v_src;
  if position('can_see_video_row(v.club_id, v.group_id)' in v_src) = 0 then
    if position(v_old in v_src) = 0 then raise exception 'file_access_lr: blocul „videos" nu a fost găsit'; end if;
    v_src := replace(v_src, v_old, E'    end if;\n    return exists (select 1 from public.videos v where v.storage_path = p_path and private.can_see_video_row(v.club_id, v.group_id));\n  elsif p_bucket = ''contracts''');
    execute v_src;
  end if;
end $$;

/**
 * Echipele cu care e partajată înregistrarea (lista completă, înlocuiește lista veche).
 * Antrenorii echipelor adăugate primesc o notificare.
 */
create or replace function public.share_video_with_groups(p_video uuid, p_groups uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare v record; v_new uuid[]; v_user uuid; v_n int := 0;
begin
  select * into v from public.videos where id = p_video for update;
  if not found or not private.can_see_video(p_video) then raise exception 'Înregistrarea nu a fost găsită.' using errcode = 'P0002'; end if;
  if exists (select 1 from unnest(coalesce(p_groups, '{}')) g where private.group_club(g) is distinct from v.club_id) then
    raise exception 'Echipă necunoscută.' using errcode = '42501';
  end if;
  -- echipa înregistrării nu are nevoie de partajare
  p_groups := array(select distinct g from unnest(coalesce(p_groups, '{}')) g where g is distinct from v.group_id);
  v_new := array(select g from unnest(p_groups) g where not (g = any (v.shared_group_ids)));
  update public.videos set shared_group_ids = p_groups where id = p_video;

  for v_user in
    select distinct sg.user_id from public.staff_groups sg
    join public.profiles p on p.id = sg.user_id and p.is_active and p.role = 'coach'
    where sg.group_id = any (v_new) and sg.user_id is distinct from app_auth.uid()
      and not (v.group_id is not null and sg.user_id in (select s2.user_id from public.staff_groups s2 where s2.group_id = v.group_id))
  loop
    perform private.notify(v_user, 'video_shared', 'Înregistrare partajată cu echipa ta', v.title, '/performanta/video/' || v.id, 'video_shared:' || v.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.share_video_with_groups(uuid, uuid[]) from public, anon;
grant execute on function public.share_video_with_groups(uuid, uuid[]) to authenticated;
