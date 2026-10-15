-- Locker Room faza 4 · Video: înregistrări (VEO, YouTube, Vimeo sau fișier încărcat) legate de evenimente,
-- marcaje pe cronologie, clipuri etichetate cu jucători. Familia vede doar clipurile partajate explicit
-- în care apare copilul ei, niciodată toată înregistrarea.

create table public.videos (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  group_id      uuid references public.groups(id) on delete set null,
  event_id      uuid references public.events(id) on delete set null,
  title         text not null check (length(trim(title)) between 2 and 120),
  source        text not null check (source in ('veo', 'youtube', 'vimeo', 'upload', 'other')),
  url           text check (url is null or url ~ '^https://'),
  storage_path  text unique,                       -- depozitul „videos": <club>/<uuid>-<nume>
  recorded_on   date not null,
  duration_sec  int check (duration_sec between 1 and 86400),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  check ((source = 'upload') = (storage_path is not null)),
  check (source = 'upload' or url is not null)
);
create index videos_club_idx on public.videos (club_id, recorded_on desc);
create index videos_event_idx on public.videos (event_id);

create table public.video_markers (
  id          uuid primary key default gen_random_uuid(),
  video_id    uuid not null references public.videos(id) on delete cascade,
  t_sec       int not null check (t_sec between 0 and 86400),
  end_sec     int check (end_sec is null or end_sec > t_sec),
  tag         text not null default 'other' check (tag in ('goal', 'chance', 'defending', 'set_piece', 'mistake', 'highlight', 'other')),
  label       text check (label is null or length(label) <= 200),
  shared      boolean not null default false,        -- clipul ajunge la jucătorii etichetați și la părinții lor
  shared_at   timestamptz,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index video_markers_video_idx on public.video_markers (video_id, t_sec);

create table public.video_marker_players (
  marker_id uuid not null references public.video_markers(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  primary key (marker_id, player_id)
);
create index video_marker_players_player_idx on public.video_marker_players (player_id);

-- ---------------------------------------------------------------------------
-- Cine vede și cine lucrează cu video
-- ---------------------------------------------------------------------------
/** Staff-ul sportiv: directorul și preparatorul toate; antrenorul înregistrările echipelor lui (și cele fără echipă). */
create or replace function private.can_see_video_row(p_club uuid, p_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_club = private.my_club()
     and (private.my_role() in ('sporting_director', 'physio')
          or (private.my_role() = 'coach' and (p_group is null or p_group = any (private.my_group_ids()))))
$$;
create or replace function private.can_see_video(p_video uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.can_see_video_row(v.club_id, v.group_id) from public.videos v where v.id = p_video), false)
$$;
/** Un clip partajat în care apare unul dintre „jucătorii mei" (eu sau copilul meu). */
create or replace function private.can_see_shared_marker(p_marker uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.video_markers m join public.video_marker_players mp on mp.marker_id = m.id
    where m.id = p_marker and m.shared and mp.player_id = any (private.my_player_ids())
  )
$$;
/** Fișierul unei înregistrări din care mi s-a partajat cel puțin un clip (familia nu vede rândul video). */
create or replace function private.video_file_shared_with_me(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.videos v join public.video_markers m on m.video_id = v.id
                 where v.storage_path = p_path and v.club_id = private.my_club() and private.can_see_shared_marker(m.id))
$$;
grant execute on function private.can_see_video_row(uuid, uuid), private.can_see_video(uuid), private.can_see_shared_marker(uuid),
  private.video_file_shared_with_me(text) to authenticated;

alter table public.videos enable row level security;
alter table public.video_markers enable row level security;
alter table public.video_marker_players enable row level security;

create policy videos_select on public.videos for select to authenticated
  using (private.can_see_video_row(club_id, group_id));
create policy videos_write on public.videos for all to authenticated
  using (private.can_see_video_row(club_id, group_id))
  with check (club_id = (select private.my_club())
          and ((select private.my_role()) in ('sporting_director', 'physio')
               or ((select private.my_role()) = 'coach' and group_id = any ((select private.my_group_ids())::uuid[]))));
create policy video_markers_select on public.video_markers for select to authenticated
  using (private.can_see_video(video_id) or private.can_see_shared_marker(id));
create policy video_markers_write on public.video_markers for all to authenticated
  using (private.can_see_video(video_id)) with check (private.can_see_video(video_id));
create policy video_marker_players_select on public.video_marker_players for select to authenticated
  -- familia vede doar propriul jucător pe clip, nu și colegii etichetați
  using (exists (select 1 from public.video_markers m where m.id = marker_id and private.can_see_video(m.video_id))
         or (player_id = any ((select private.my_player_ids())::uuid[]) and private.can_see_shared_marker(marker_id)));
create policy video_marker_players_write on public.video_marker_players for all to authenticated
  using (exists (select 1 from public.video_markers m where m.id = marker_id and private.can_see_video(m.video_id)))
  with check (exists (select 1 from public.video_markers m join public.videos v on v.id = m.video_id
                      join public.players pl on pl.id = player_id and pl.club_id = v.club_id
                      where m.id = marker_id and private.can_see_video(m.video_id)));
grant select, insert, update, delete on public.videos, public.video_markers, public.video_marker_players to authenticated;

do $$
declare t text;
begin
  foreach t in array array['videos', 'video_markers'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit()', t || '_audit', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Clipurile familiei: datele de redare (sursa, adresa, intervalul), fără restul înregistrării.
-- ---------------------------------------------------------------------------
create or replace function public.my_clips() returns table (
  marker_id uuid, player_id uuid, player_name text, video_title text, recorded_on date, source text, url text, storage_path text,
  t_sec int, end_sec int, tag text, label text, shared_at timestamptz
) language sql stable security definer set search_path = '' as $$
  select m.id, mp.player_id, pl.display_name, v.title, v.recorded_on, v.source, v.url, v.storage_path, m.t_sec, m.end_sec, m.tag, m.label, m.shared_at
  from public.video_markers m
  join public.video_marker_players mp on mp.marker_id = m.id
  join public.players pl on pl.id = mp.player_id
  join public.videos v on v.id = m.video_id
  where m.shared and mp.player_id = any (private.my_player_ids()) and v.club_id = private.my_club()
  order by coalesce(m.shared_at, m.created_at) desc
  limit 200
$$;
grant execute on function public.my_clips() to authenticated;

/** Partajarea unui clip: doar cu început și sfârșit și cu cel puțin un jucător etichetat; anunță familiile. */
create or replace function public.share_video_marker(p_marker uuid, p_share boolean) returns int
language plpgsql security definer set search_path = '' as $$
declare v_m record; v_user uuid; v_n int := 0; r record;
begin
  select m.*, v.title into v_m from public.video_markers m join public.videos v on v.id = m.video_id where m.id = p_marker for update of m;
  if not found or not private.can_see_video(v_m.video_id) then raise exception 'Clipul nu a fost găsit.' using errcode = 'P0002'; end if;
  if not p_share then
    update public.video_markers set shared = false, shared_at = null where id = p_marker;
    return 0;
  end if;
  if v_m.end_sec is null then raise exception 'Un clip partajat are nevoie de sfârșit (cel mult câteva minute).' using errcode = '22023'; end if;
  if v_m.end_sec - v_m.t_sec > 600 then raise exception 'Un clip partajat are cel mult 10 minute.' using errcode = '22023'; end if;
  if not exists (select 1 from public.video_marker_players where marker_id = p_marker) then
    raise exception 'Etichetează cel puțin un jucător înainte de partajare.' using errcode = '22023';
  end if;
  update public.video_markers set shared = true, shared_at = coalesce(shared_at, now()) where id = p_marker;
  for r in select pl.id, pl.display_name from public.video_marker_players mp join public.players pl on pl.id = mp.player_id where mp.marker_id = p_marker loop
    for v_user in select * from private.visa_reminder_targets(r.id) loop
      perform private.notify(v_user, 'video_shared', 'Clip nou: ' || r.display_name, v_m.title, '/clipuri', 'clip:' || p_marker || ':' || v_user);
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end $$;
grant execute on function public.share_video_marker(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Depozitul „videos" (fișiere încărcate): <club>/<fișier>
-- ---------------------------------------------------------------------------
create or replace function private.file_access_lr(p_bucket text, p_path text, p_action text, p_owner uuid, p_role public.app_role)
returns boolean language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_bucket = 'visas' then
    if p_action = 'read' then
      return exists (select 1 from public.visa_documents d where d.storage_path = p_path);
    elsif p_action = 'write' then
      return (p_owner = any ((select private.my_player_ids())::uuid[]) or (select private.can_manage_visas()))
         and exists (select 1 from public.players pl where pl.id = p_owner and pl.club_id = (select private.my_club()))
         and not exists (select 1 from public.visa_documents d where d.storage_path = p_path);
    end if;
    return (select private.can_manage_visas());

  elsif p_bucket = 'videos' then
    if p_owner is distinct from (select private.my_club()) then return false; end if;
    if p_action = 'read' then
      -- staff-ul care vede înregistrarea sau familia unui clip partajat din ea
      return exists (select 1 from public.videos v where v.storage_path = p_path)
          or (select private.video_file_shared_with_me(p_path));
    elsif p_action = 'write' then
      return p_role in ('sporting_director', 'physio', 'coach') and not exists (select 1 from public.videos v where v.storage_path = p_path);
    end if;
    return exists (select 1 from public.videos v where v.storage_path = p_path);
  end if;
  return false;
end $$;

-- GDPR
create or replace function private.scrub_player_lr(p_player uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.visa_documents where player_id = p_player;
  delete from public.evaluations where player_id = p_player;
  delete from public.video_marker_players where player_id = p_player;
  delete from public.notifications n
  where coalesce(p_name, '') <> '' and n.kind in ('visa_document', 'visa_reminder', 'evaluation_published', 'video_shared')
    and n.title like '%' || p_name || '%';
end $$;
