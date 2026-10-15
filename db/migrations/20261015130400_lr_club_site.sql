-- Locker Room · Faza 4 · Club: site-ul public și știrile din aplicație (un singur editor), galerii cu acord foto,
-- setări explicate cu jurnal de modificări, politică de confidențialitate cu versiuni.
--
-- Fotografiile apar public doar dacă TOȚI copiii etichetați au acordul foto (players.photo_consent). Acordul se
-- pornește automat când părintele semnează în aplicație un document de tip „Fotografii și video" și se poate retrage
-- oricând din contul familiei; retragerea ascunde imediat fotografiile.
-- Fișierele stau în depozitul „site": <club>/<post|foto>/<uuid>.<ext>; vizitatorii le primesc doar prin
-- /c/<slug>/media/…, verificat de site_public_file.

create or replace function private.can_manage_website() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.my_role()) in ('admin', 'secretary'), false)
$$;
grant execute on function private.can_manage_website() to authenticated;

/** Echipele copiilor mei (părinte) sau a mea (jucător). */
create or replace function private.my_family_group_ids() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct pl.group_id) filter (where pl.group_id is not null), '{}'::uuid[])
  from public.players pl where pl.id = any (private.my_player_ids())
$$;

-- ---------------------------------------------------------------------------
-- Știri: același articol pe site și/sau în aplicație
-- ---------------------------------------------------------------------------
create table public.site_posts (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs(id) on delete cascade,
  title          text not null check (length(title) between 3 and 160),
  slug           text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
  excerpt        text check (length(excerpt) <= 300),
  blocks         jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks) = 'array' and jsonb_array_length(blocks) <= 60),
  cover_path     text,
  status         text not null default 'draft' check (status in ('draft', 'published')),
  to_site        boolean not null default true,
  to_app         boolean not null default false,
  app_group_ids  uuid[] not null default '{}',
  published_at   timestamptz,
  notified_at    timestamptz,
  author_id      uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (club_id, slug),
  check (pg_column_size(blocks) < 200000)
);
create index site_posts_club_idx on public.site_posts (club_id, status, published_at desc);

alter table public.site_posts enable row level security;
create policy site_posts_select on public.site_posts for select to authenticated
  using (club_id = (select private.my_club()) and (
    (select private.can_manage_website())
    or (status = 'published' and to_app and (
          (select private.my_role()) not in ('guardian', 'player')
          or app_group_ids = '{}'::uuid[] or app_group_ids && (select private.my_family_group_ids())))));
grant select on public.site_posts to authenticated;

/** Blocurile permise: paragraph, heading, quote, list, image. Restul se aruncă. */
create or replace function private.clean_blocks(p_blocks jsonb, p_club uuid) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(b order by o), '[]'::jsonb) from (
    select o, case x->>'type'
      when 'paragraph' then jsonb_build_object('type', 'paragraph', 'text', left(coalesce(x->>'text', ''), 5000))
      when 'heading' then jsonb_build_object('type', 'heading', 'text', left(coalesce(x->>'text', ''), 160))
      when 'quote' then jsonb_build_object('type', 'quote', 'text', left(coalesce(x->>'text', ''), 1000), 'by', left(coalesce(x->>'by', ''), 120))
      when 'list' then jsonb_build_object('type', 'list', 'items',
        coalesce((select jsonb_agg(left(i, 300)) from jsonb_array_elements_text(case when jsonb_typeof(x->'items') = 'array' then x->'items' else '[]'::jsonb end) i), '[]'::jsonb))
      when 'image' then case when (x->>'path') like p_club::text || '/post/%' then
        jsonb_build_object('type', 'image', 'path', x->>'path', 'alt', left(coalesce(x->>'alt', ''), 200), 'caption', left(coalesce(x->>'caption', ''), 300)) end
      end as b
    from jsonb_array_elements(case when jsonb_typeof(p_blocks) = 'array' then p_blocks else '[]'::jsonb end) with ordinality as e(x, o)
  ) s where b is not null
$$;

/** Rezumatul: cel scris de birou sau începutul primului paragraf. */
create or replace function private.post_excerpt(p_excerpt text, p_blocks jsonb) returns text
language sql immutable set search_path = '' as $$
  select coalesce(nullif(trim(p_excerpt), ''), (
    select case when length(t) > 200 then left(t, 197) || '…' else t end
    from (select regexp_replace(b->>'text', '\s+', ' ', 'g') as t from jsonb_array_elements(p_blocks) with ordinality e(b, o)
          where b->>'type' = 'paragraph' and trim(b->>'text') <> '' order by o limit 1) x))
$$;

/** Slugul vine gata din aplicație (diacriticele se scot acolo); aici doar se validează și se curăță. */
create or replace function private.slugify(p text) returns text
language sql immutable set search_path = '' as $$
  select left(trim(both '-' from regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]+', '-', 'g')), 80)
$$;

-- p = { id?, title, slug? (fără diacritice, din aplicație), excerpt?, blocks, cover_path?, to_site, to_app, app_group_ids }
create or replace function public.save_site_post(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); v_id uuid := nullif(p->>'id', '')::uuid; v_slug text; v_base text; v_n int := 1;
        v_cover text := nullif(p->>'cover_path', ''); v_groups uuid[];
begin
  if not private.can_manage_website() then raise exception 'Doar biroul publică știri.' using errcode = '42501'; end if;
  if length(trim(coalesce(p->>'title', ''))) < 3 then raise exception 'Scrie un titlu.' using errcode = '22023'; end if;
  if v_cover is not null and v_cover not like v_club::text || '/post/%' then v_cover := null; end if;
  select coalesce(array_agg(g.id), '{}') into v_groups from public.groups g
  where g.club_id = v_club and g.id::text in (select jsonb_array_elements_text(coalesce(p->'app_group_ids', '[]'::jsonb)));
  if v_id is null then
    v_base := coalesce(nullif(private.slugify(coalesce(p->>'slug', p->>'title')), ''), 'stire');
    v_slug := v_base;
    while exists (select 1 from public.site_posts where club_id = v_club and slug = v_slug) loop
      v_n := v_n + 1; v_slug := left(v_base, 76) || '-' || v_n;
    end loop;
    insert into public.site_posts (club_id, title, slug, excerpt, blocks, cover_path, to_site, to_app, app_group_ids, author_id)
    values (v_club, trim(p->>'title'), v_slug, nullif(trim(p->>'excerpt'), ''), private.clean_blocks(p->'blocks', v_club), v_cover,
            coalesce((p->>'to_site')::boolean, true), coalesce((p->>'to_app')::boolean, false), v_groups, app_auth.uid())
    returning id into v_id;
  else
    update public.site_posts set title = trim(p->>'title'), excerpt = nullif(trim(p->>'excerpt'), ''), blocks = private.clean_blocks(p->'blocks', v_club),
      cover_path = v_cover, to_site = coalesce((p->>'to_site')::boolean, to_site), to_app = coalesce((p->>'to_app')::boolean, to_app),
      app_group_ids = v_groups, updated_at = now()
    where id = v_id and club_id = v_club;
    if not found then raise exception 'Știrea nu a fost găsită.' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end $$;

/** Publicarea; la prima publicare în aplicație, familiile (echipele alese sau toate) primesc o notificare. */
create or replace function public.publish_site_post(p_id uuid, p_publish boolean) returns int
language plpgsql security definer set search_path = '' as $$
declare v_p record; v_n int := 0;
begin
  if not private.can_manage_website() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  select * into v_p from public.site_posts where id = p_id and club_id = private.my_club() for update;
  if not found then raise exception 'Știrea nu a fost găsită.' using errcode = 'P0002'; end if;
  if p_publish and not v_p.to_site and not v_p.to_app then raise exception 'Alege unde apare: pe site, în aplicație sau în ambele.' using errcode = '22023'; end if;
  update public.site_posts set status = case when p_publish then 'published' else 'draft' end,
    published_at = case when p_publish then coalesce(published_at, now()) else published_at end, updated_at = now()
  where id = p_id;
  if p_publish and v_p.to_app and v_p.notified_at is null then
    insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
    select distinct u.uid, 'news', left(v_p.title, 140), private.post_excerpt(v_p.excerpt, v_p.blocks), '/noutati/' || p_id, 'news:' || p_id
    from (
      select g.user_id as uid from public.guardians g join public.guardian_players gp on gp.guardian_id = g.id
      join public.players pl on pl.id = gp.player_id and pl.is_active
      where g.club_id = v_p.club_id and g.deleted_at is null and g.user_id is not null
        and (v_p.app_group_ids = '{}'::uuid[] or pl.group_id = any (v_p.app_group_ids))
      union
      select pl.user_id from public.players pl
      where pl.club_id = v_p.club_id and pl.is_active and pl.user_id is not null
        and (v_p.app_group_ids = '{}'::uuid[] or pl.group_id = any (v_p.app_group_ids))
    ) u join public.profiles pr on pr.id = u.uid and pr.is_active
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics v_n = row_count;
    update public.site_posts set notified_at = now() where id = p_id;
  end if;
  return v_n;
end $$;

create or replace function public.delete_site_post(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_website() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  delete from public.site_posts where id = p_id and club_id = private.my_club();
  delete from public.notifications where dedupe_key = 'news:' || p_id;
end $$;

-- ---------------------------------------------------------------------------
-- Galerii
-- ---------------------------------------------------------------------------
create table public.site_albums (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  title       text not null check (length(title) between 2 and 120),
  taken_on    date,
  status      text not null default 'draft' check (status in ('draft', 'published')),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create table public.site_photos (
  id          uuid primary key default gen_random_uuid(),
  album_id    uuid not null references public.site_albums(id) on delete cascade,
  club_id     uuid not null references public.clubs(id) on delete cascade,
  path        text not null unique,
  caption     text check (length(caption) <= 300),
  player_ids  uuid[] not null default '{}',
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
create index site_photos_album_idx on public.site_photos (album_id, sort);
create index site_photos_players_idx on public.site_photos using gin (player_ids);

alter table public.site_albums enable row level security;
alter table public.site_photos enable row level security;
create policy site_albums_select on public.site_albums for select to authenticated
  using (club_id = (select private.my_club()) and (select private.can_manage_website()));
create policy site_photos_select on public.site_photos for select to authenticated
  using (club_id = (select private.my_club()) and (select private.can_manage_website()));
grant select on public.site_albums, public.site_photos to authenticated;

/** O fotografie e publică dacă albumul e publicat și toți copiii etichetați au acordul foto. */
create or replace function private.photo_is_public(p_photo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.site_photos ph join public.site_albums a on a.id = ph.album_id and a.status = 'published'
    where ph.id = p_photo
      and not exists (select 1 from public.players pl where pl.id = any (ph.player_ids) and (not pl.photo_consent or pl.anonymized_at is not null)))
$$;

create or replace function public.save_album(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := nullif(p->>'id', '')::uuid;
begin
  if not private.can_manage_website() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  if v_id is null then
    insert into public.site_albums (club_id, title, taken_on, status, created_by)
    values (private.my_club(), trim(p->>'title'), nullif(p->>'taken_on', '')::date, coalesce(nullif(p->>'status', ''), 'draft'), app_auth.uid())
    returning id into v_id;
  else
    update public.site_albums set title = trim(p->>'title'), taken_on = nullif(p->>'taken_on', '')::date, status = coalesce(nullif(p->>'status', ''), status)
    where id = v_id and club_id = private.my_club();
    if not found then raise exception 'Albumul nu a fost găsit.' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end $$;

-- p = { id?, album_id, path, caption?, player_ids }
create or replace function public.save_photo(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); v_id uuid := nullif(p->>'id', '')::uuid; v_players uuid[];
begin
  if not private.can_manage_website() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  select coalesce(array_agg(pl.id), '{}') into v_players from public.players pl
  where pl.club_id = v_club and pl.id::text in (select jsonb_array_elements_text(coalesce(p->'player_ids', '[]'::jsonb)));
  if v_id is null then
    if not exists (select 1 from public.site_albums a where a.id = (p->>'album_id')::uuid and a.club_id = v_club) then
      raise exception 'Albumul nu a fost găsit.' using errcode = 'P0002';
    end if;
    if (p->>'path') not like v_club::text || '/foto/%' then raise exception 'Fișier invalid.' using errcode = '22023'; end if;
    insert into public.site_photos (album_id, club_id, path, caption, player_ids, sort)
    values ((p->>'album_id')::uuid, v_club, p->>'path', nullif(trim(p->>'caption'), ''), v_players,
            coalesce((select max(sort) + 1 from public.site_photos where album_id = (p->>'album_id')::uuid), 0))
    returning id into v_id;
  else
    update public.site_photos set caption = nullif(trim(p->>'caption'), ''), player_ids = v_players where id = v_id and club_id = v_club;
    if not found then raise exception 'Fotografia nu a fost găsită.' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.delete_photo(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_path text;
begin
  if not private.can_manage_website() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  delete from public.site_photos where id = p_id and club_id = private.my_club() returning path into v_path;
  return v_path;
end $$;

create or replace function public.delete_album(p_id uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare v_paths text[];
begin
  if not private.can_manage_website() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  select coalesce(array_agg(path), '{}') into v_paths from public.site_photos where album_id = p_id and club_id = private.my_club();
  delete from public.site_albums where id = p_id and club_id = private.my_club();
  return v_paths;
end $$;

/** Câte fotografii publicate sunt ascunse pentru lipsa acordului (pentru birou). */
create or replace function public.photo_consent_state(p_album uuid)
returns table (photo_id uuid, is_public boolean, missing text[])
language sql stable security definer set search_path = '' as $$
  select ph.id, private.photo_is_public(ph.id),
         coalesce((select array_agg(pl.full_name order by pl.full_name) from public.players pl
                   where pl.id = any (ph.player_ids) and not pl.photo_consent), '{}')
  from public.site_photos ph
  where ph.album_id = p_album and ph.club_id = private.my_club() and private.can_manage_website()
$$;

-- Acordul foto: pornit de semnarea unui document „Fotografii și video", retras de familie.
create or replace function private.contract_photo_consent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'signed' and old.status is distinct from 'signed' and new.player_id is not null
     and exists (select 1 from public.contract_template_versions v join public.contract_templates t on t.id = v.template_id
                 where v.id = new.template_version_id and t.kind = 'photo_consent') then
    update public.players set photo_consent = true where id = new.player_id;
  end if;
  return new;
end $$;
create trigger contracts_photo_consent after update of status on public.contracts
  for each row execute function private.contract_photo_consent();

create or replace function public.withdraw_photo_consent(p_player uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (p_player = any (private.my_player_ids()) or private.can_manage_player(p_player)) then raise exception 'Acces interzis' using errcode = '42501'; end if;
  update public.players set photo_consent = false where id = p_player;
  perform private.notify_users(private.my_club(), array['admin', 'secretary']::public.app_role[], 'news',
    'Acord foto retras', (select full_name from public.players where id = p_player), '/club/site/galerie', 'photo_withdrawn:' || p_player || ':' || to_char(now(), 'YYYYMMDDHH24MI'), app_auth.uid());
end $$;

-- ---------------------------------------------------------------------------
-- Setări (clubs.settings.site) cu jurnal, politica de confidențialitate cu versiuni
-- ---------------------------------------------------------------------------
create table public.site_changes (
  id        bigint generated always as identity primary key,
  club_id   uuid not null references public.clubs(id) on delete cascade,
  at        timestamptz not null default now(),
  actor_id  uuid references public.profiles(id) on delete set null,
  field     text not null,
  old_value jsonb,
  new_value jsonb
);
create index site_changes_club_idx on public.site_changes (club_id, at desc);
create table public.site_policies (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  version       int not null,
  body          text not null check (length(body) between 50 and 60000),
  published_at  timestamptz not null default now(),
  published_by  uuid references public.profiles(id) on delete set null,
  unique (club_id, version)
);
alter table public.site_changes enable row level security;
alter table public.site_policies enable row level security;
create policy site_changes_select on public.site_changes for select to authenticated
  using (club_id = (select private.my_club()) and (select private.can_manage_website()));
create policy site_policies_select on public.site_policies for select to authenticated
  using (club_id = (select private.my_club()));
grant select on public.site_changes, public.site_policies to authenticated;

/**
 * Setările site-ului: doar cheile cunoscute, cu tipul lor; fiecare schimbare intră în jurnal.
 *   secțiuni (bool): news teams camps gallery enrolment support contact indexable show_staff
 *   texte: tagline about address email phone map_url facebook instagram youtube tiktok
 *   roster_groups: uuid[] (echipe cu lotul public; apar doar jucătorii majori)
 */
create or replace function public.save_site_settings(p jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); v_old jsonb; v_new jsonb; k text; v jsonb; v_n int := 0;
  bools text[] := array['news', 'teams', 'camps', 'gallery', 'enrolment', 'support', 'contact', 'indexable', 'show_staff'];
  texts text[] := array['tagline', 'about', 'address', 'email', 'phone', 'map_url', 'facebook', 'instagram', 'youtube', 'tiktok'];
begin
  if not private.can_manage_website() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  select coalesce(settings->'site', '{}'::jsonb) into v_old from public.clubs where id = v_club for update;
  v_new := v_old;
  for k, v in select * from jsonb_each(p) loop
    if k = any (bools) and jsonb_typeof(v) = 'boolean' then
      v_new := v_new || jsonb_build_object(k, v);
    elsif k = any (texts) and jsonb_typeof(v) in ('string', 'null') then
      if k in ('map_url', 'facebook', 'instagram', 'youtube', 'tiktok') and coalesce(v #>> '{}', '') <> '' and (v #>> '{}') !~ '^https://' then
        raise exception 'Adresele trebuie să înceapă cu https://' using errcode = '22023';
      end if;
      v_new := v_new || jsonb_build_object(k, nullif(left(trim(coalesce(v #>> '{}', '')), case when k = 'about' then 4000 else 300 end), ''));
    elsif k = 'roster_groups' and jsonb_typeof(v) = 'array' then
      v_new := v_new || jsonb_build_object(k, coalesce((select jsonb_agg(g.id) from public.groups g
        where g.club_id = v_club and g.id::text in (select jsonb_array_elements_text(v))), '[]'::jsonb));
    end if;
  end loop;
  for k in select key from jsonb_each(v_new) loop
    if (v_old->k) is distinct from (v_new->k) then
      insert into public.site_changes (club_id, actor_id, field, old_value, new_value) values (v_club, app_auth.uid(), k, v_old->k, v_new->k);
      v_n := v_n + 1;
    end if;
  end loop;
  update public.clubs set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{site}', v_new) where id = v_club;
  return v_n;
end $$;

create or replace function public.publish_site_policy(p_body text) returns int
language plpgsql security definer set search_path = '' as $$
declare v_v int;
begin
  if not private.can_manage_website() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  if length(trim(coalesce(p_body, ''))) < 50 then raise exception 'Politica e prea scurtă.' using errcode = '22023'; end if;
  if trim(p_body) = (select body from public.site_policies where club_id = private.my_club() order by version desc limit 1) then
    raise exception 'Textul nu s-a schimbat.' using errcode = '22023';
  end if;
  select coalesce(max(version), 0) + 1 into v_v from public.site_policies where club_id = private.my_club();
  insert into public.site_policies (club_id, version, body, published_by) values (private.my_club(), v_v, trim(p_body), app_auth.uid());
  insert into public.site_changes (club_id, actor_id, field, new_value) values (private.my_club(), app_auth.uid(), 'policy', to_jsonb(v_v));
  return v_v;
end $$;

grant execute on function public.save_site_post(jsonb), public.publish_site_post(uuid, boolean), public.delete_site_post(uuid),
  public.save_album(jsonb), public.save_photo(jsonb), public.delete_photo(uuid), public.delete_album(uuid), public.photo_consent_state(uuid),
  public.withdraw_photo_consent(uuid), public.save_site_settings(jsonb), public.publish_site_policy(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Citirea publică (fără cont)
-- ---------------------------------------------------------------------------
create or replace function public.public_posts(p_slug text, p_limit int default 12, p_offset int default 0)
returns table (id uuid, title text, slug text, excerpt text, cover_path text, published_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.title, p.slug, private.post_excerpt(p.excerpt, p.blocks), p.cover_path, p.published_at from public.site_posts p
  where p.club_id = private.club_by_slug(p_slug) and p.status = 'published' and p.to_site
  order by p.published_at desc limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
$$;

create or replace function public.public_post(p_slug text, p_post text)
returns table (id uuid, title text, slug text, excerpt text, cover_path text, blocks jsonb, published_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.title, p.slug, private.post_excerpt(p.excerpt, p.blocks), p.cover_path, p.blocks, p.published_at from public.site_posts p
  where p.club_id = private.club_by_slug(p_slug) and p.status = 'published' and p.to_site and p.slug = p_post
$$;

create or replace function public.public_albums(p_slug text)
returns table (id uuid, title text, taken_on date, cover_path text, photos int)
language sql stable security definer set search_path = '' as $$
  select a.id, a.title, a.taken_on,
         (select ph.path from public.site_photos ph where ph.album_id = a.id and private.photo_is_public(ph.id) order by ph.sort limit 1),
         (select count(*)::int from public.site_photos ph where ph.album_id = a.id and private.photo_is_public(ph.id))
  from public.site_albums a
  where a.club_id = private.club_by_slug(p_slug) and a.status = 'published'
    and exists (select 1 from public.site_photos ph where ph.album_id = a.id and private.photo_is_public(ph.id))
  order by a.taken_on desc nulls last, a.created_at desc
$$;

/** Fotografiile publice ale unui album: fără numele copiilor. */
create or replace function public.public_album(p_slug text, p_album uuid)
returns table (title text, taken_on date, path text, caption text)
language sql stable security definer set search_path = '' as $$
  select a.title, a.taken_on, ph.path, ph.caption
  from public.site_albums a join public.site_photos ph on ph.album_id = a.id
  where a.id = p_album and a.club_id = private.club_by_slug(p_slug) and a.status = 'published' and private.photo_is_public(ph.id)
  order by ph.sort, ph.created_at
$$;

/** Echipele: anii, antrenorii (dacă setarea e pornită) și lotul doar pentru echipele alese, doar jucătorii majori. */
create or replace function public.public_teams(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with c as (select id, coalesce(settings->'site', '{}'::jsonb) as s from public.clubs where slug = lower(trim(p_slug)))
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id, 'name', g.name, 'from', g.birth_year_from, 'to', g.birth_year_to,
    'coaches', case when coalesce((c.s->>'show_staff')::boolean, false) then
      coalesce((select jsonb_agg(pr.full_name order by pr.full_name) from public.staff_groups sg join public.profiles pr on pr.id = sg.user_id and pr.is_active and pr.role = 'coach'
                where sg.group_id = g.id), '[]'::jsonb) else '[]'::jsonb end,
    'roster', case when c.s->'roster_groups' ? g.id::text then
      coalesce((select jsonb_agg(jsonb_build_object('name', pl.display_name, 'number', pl.shirt_number, 'position', pl.position) order by pl.shirt_number nulls last, pl.display_name)
                from public.players pl where pl.group_id = g.id and pl.is_active and pl.anonymized_at is null
                  and pl.birth_date is not null and pl.birth_date <= private.club_today(c.id) - interval '18 years'), '[]'::jsonb) else '[]'::jsonb end
  ) order by g.sort), '[]'::jsonb)
  from c join public.groups g on g.club_id = c.id and g.is_active
$$;

create or replace function public.public_policy(p_slug text)
returns table (version int, body text, published_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.version, p.body, p.published_at from public.site_policies p
  where p.club_id = private.club_by_slug(p_slug) order by p.version desc limit 1
$$;

/** Un fișier din „site" se servește public doar dacă e folosit de o știre publicată pe site sau e o fotografie publică. */
create or replace function public.site_public_file(p_slug text, p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.site_posts p where p.club_id = private.club_by_slug(p_slug) and p.status = 'published' and p.to_site
                   and (p.cover_path = p_path or p.blocks @> jsonb_build_array(jsonb_build_object('path', p_path))))
      or exists (select 1 from public.site_photos ph where ph.club_id = private.club_by_slug(p_slug) and ph.path = p_path and private.photo_is_public(ph.id))
$$;

grant execute on function public.public_posts(text, int, int), public.public_post(text, text), public.public_albums(text),
  public.public_album(text, uuid), public.public_teams(text), public.public_policy(text), public.site_public_file(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Depozitele „site" (știri, galerii) și „shop" (fotografiile produselor)
-- ---------------------------------------------------------------------------
create or replace function private.site_file_access(p_path text, p_action text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when private.can_manage_website() then split_part(p_path, '/', 2) in ('post', 'foto')
    -- ștergerea datelor unui jucător (GDPR): fotografiile în care e etichetat
    when p_action = 'delete' then exists (select 1 from public.site_photos ph, unnest(ph.player_ids) pid
                                          where ph.path = p_path and private.can_manage_player(pid))
    when p_action <> 'read' then false
    -- în aplicație: imaginile știrilor pe care utilizatorul le vede (RLS pe site_posts)
    else exists (select 1 from public.site_posts p where p.cover_path = p_path or p.blocks @> jsonb_build_array(jsonb_build_object('path', p_path)))
  end
$$;
grant execute on function private.site_file_access(text, text) to authenticated;

do $$
declare v_src text;
begin
  select pg_get_functiondef('private.file_access_lr(text, text, text, uuid, public.app_role)'::regprocedure) into v_src;
  if position('site_file_access' in v_src) = 0 then
    v_src := replace(v_src, E'  end if;\n  return false;\nend', E'  elsif p_bucket = ''site'' then\n    if p_owner is distinct from (select private.my_club()) then return false; end if;\n    return private.site_file_access(p_path, p_action);\n  end if;\n  return false;\nend');
    if position('site_file_access' in v_src) = 0 then raise exception 'file_access_lr: punctul de inserare nu a fost găsit'; end if;
    execute v_src;
  end if;
end $$;

-- GDPR: fotografiile în care e etichetat copilul șters se șterg (fișierele întâi, din aplicație: player_file_paths)
create or replace function public.player_file_paths(p_player uuid)
returns table (bucket text, path text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_manage_player(p_player) then raise exception 'Acces interzis' using errcode = '42501'; end if;
  return query
    select 'visas'::text, d.storage_path from public.visa_documents d where d.player_id = p_player
    union all
    select 'site'::text, ph.path from public.site_photos ph where p_player = any (ph.player_ids);
end $$;

do $$
declare v_src text;
begin
  select pg_get_functiondef('private.scrub_player_lr(uuid, text)'::regprocedure) into v_src;
  if position('site_photos' in v_src) = 0 then
    v_src := regexp_replace(v_src, E'\nend;?\\s*\\$[a-z_]*\\$\\s*$',
      E'\n  delete from public.site_photos where p_player = any (player_ids);\nend;\n$function$\n');
    if position('site_photos' in v_src) = 0 then raise exception 'scrub_player_lr: punctul de inserare nu a fost găsit'; end if;
    execute v_src;
  end if;
end $$;
