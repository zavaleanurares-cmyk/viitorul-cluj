-- Secțiuni de antrenament (exerciții de teren, cu desen pe teren) și planul fiecărui antrenament.
-- Echivalentul „Secțiuni antrenament" și „Program antrenament" din The Football Brain.

-- ---------------------------------------------------------------------------
-- Secțiunile
-- ---------------------------------------------------------------------------
create table public.drills (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  created_by    uuid references public.profiles(id) on delete set null,
  name          text not null check (length(trim(name)) between 1 and 120),
  age_group     text check (length(age_group) <= 20),
  kind          text check (length(kind) <= 60),
  category      text check (category in ('basics', 'goalkeepers', 'prevention', 'technical', 'physical', 'mental', 'tactical')),
  -- „club": o vede tot staff-ul; „private": doar autorul și biroul
  visibility    text not null default 'club' check (visibility in ('club', 'private')),
  players       smallint check (players between 0 and 60),
  goalkeepers   smallint check (goalkeepers between 0 and 6),
  intensity     smallint check (intensity between 1 and 5),
  work_min      numeric(4, 1) check (work_min > 0 and work_min <= 120),
  rest_sec      int check (rest_sec between 0 and 1800),
  reps          smallint check (reps between 1 and 50),
  area          text check (length(area) <= 120),
  equipment     text check (length(equipment) <= 500),
  organization  text check (length(organization) <= 4000),
  criteria      text check (length(criteria) <= 4000),
  video_url     text check (video_url ~ '^https://' and length(video_url) <= 500),
  diagram       jsonb check (diagram is null or (jsonb_typeof(diagram) = 'object' and pg_column_size(diagram) < 64000)),
  image_paths   text[] not null default '{}' check (cardinality(image_paths) <= 6),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index drills_club_idx on public.drills (club_id, is_active, created_at desc);
create trigger drills_touch before update on public.drills for each row execute function private.touch_updated_at();
create trigger drills_audit after insert or update or delete on public.drills for each row execute function private.audit();

alter table public.drills enable row level security;
create policy drills_select on public.drills for select to authenticated
  using (club_id = (select private.my_club()) and (select private.is_club_staff())
         and (visibility = 'club' or created_by = (select app_auth.uid()) or (select private.is_office())));
create policy drills_insert on public.drills for insert to authenticated
  with check (club_id = (select private.my_club()) and (select private.is_club_staff()) and created_by = (select app_auth.uid()));
create policy drills_update on public.drills for update to authenticated
  using (club_id = (select private.my_club()) and (created_by = (select app_auth.uid()) or (select private.is_office())))
  with check (club_id = (select private.my_club()) and (created_by = (select app_auth.uid()) or (select private.is_office())));
create policy drills_delete on public.drills for delete to authenticated
  using (club_id = (select private.my_club()) and (created_by = (select app_auth.uid()) or (select private.is_office())));
grant select, insert, update, delete on public.drills to authenticated;

-- ---------------------------------------------------------------------------
-- Planul antrenamentului: temă, obiective și secțiunile, în ordine
-- ---------------------------------------------------------------------------
create table public.training_plans (
  event_id     uuid primary key references public.events(id) on delete cascade,
  theme        text check (length(theme) <= 200),
  objectives   text check (length(objectives) <= 2000),
  description  text check (length(description) <= 4000),
  updated_by   uuid references public.profiles(id) on delete set null,
  updated_at   timestamptz not null default now()
);

create table public.training_plan_items (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.training_plans(event_id) on delete cascade,
  drill_id      uuid references public.drills(id) on delete set null,
  position      smallint not null,
  -- numele se păstrează: planul rămâne lizibil și dacă secțiunea e ștearsă din bibliotecă
  title         text not null check (length(trim(title)) between 1 and 120),
  duration_min  smallint check (duration_min between 1 and 240),
  notes         text check (length(notes) <= 1000)
);
create index training_plan_items_event_idx on public.training_plan_items (event_id, position);

alter table public.training_plans enable row level security;
alter table public.training_plan_items enable row level security;
-- planul îl vede staff-ul clubului (ca tot calendarul); îl scrie cine conduce antrenamentul, prin save_training_plan
create policy training_plans_select on public.training_plans for select to authenticated
  using (private.event_club(event_id) = (select private.my_club()) and (select private.is_club_staff()));
create policy training_plan_items_select on public.training_plan_items for select to authenticated
  using (private.event_club(event_id) = (select private.my_club()) and (select private.is_club_staff()));
grant select on public.training_plans, public.training_plan_items to authenticated;

/**
 * Salvează planul unui antrenament (înlocuiește lista de secțiuni).
 *   p = { theme?, objectives?, description?, items: [{ drill_id?, title, duration_min?, notes? }] }
 * O secțiune din bibliotecă trebuie să fie vizibilă celui care salvează.
 */
create or replace function public.save_training_plan(p_event uuid, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_item jsonb; v_pos int := 0; v_drill uuid;
begin
  if not private.can_run_event(p_event) then
    raise exception 'Doar cine conduce antrenamentul îi poate face planul.' using errcode = '42501';
  end if;
  if (select kind from public.events where id = p_event) <> 'training' then
    raise exception 'Planul se face doar pentru antrenamente.';
  end if;
  if jsonb_array_length(coalesce(p->'items', '[]')) > 30 then raise exception 'Cel mult 30 de secțiuni într-un antrenament.'; end if;

  insert into public.training_plans (event_id, theme, objectives, description, updated_by, updated_at)
  values (p_event, nullif(trim(p->>'theme'), ''), nullif(trim(p->>'objectives'), ''), nullif(trim(p->>'description'), ''), app_auth.uid(), now())
  on conflict (event_id) do update set theme = excluded.theme, objectives = excluded.objectives,
    description = excluded.description, updated_by = excluded.updated_by, updated_at = now();

  delete from public.training_plan_items where event_id = p_event;
  for v_item in select * from jsonb_array_elements(coalesce(p->'items', '[]')) loop
    v_drill := nullif(v_item->>'drill_id', '')::uuid;
    if v_drill is not null and not exists (
      select 1 from public.drills d where d.id = v_drill and d.club_id = private.my_club()
        and (d.visibility = 'club' or d.created_by = app_auth.uid() or private.is_office())) then
      raise exception 'Secțiune necunoscută.' using errcode = '42501';
    end if;
    v_pos := v_pos + 1;
    insert into public.training_plan_items (event_id, drill_id, position, title, duration_min, notes)
    values (p_event, v_drill, v_pos, trim(v_item->>'title'), nullif(v_item->>'duration_min', '')::smallint, nullif(trim(v_item->>'notes'), ''));
  end loop;

  -- un plan gol nu rămâne în baza de date
  if v_pos = 0 and coalesce(nullif(trim(p->>'theme'), ''), nullif(trim(p->>'objectives'), ''), nullif(trim(p->>'description'), '')) is null then
    delete from public.training_plans where event_id = p_event;
  end if;
end $$;
revoke all on function public.save_training_plan(uuid, jsonb) from public, anon;
grant execute on function public.save_training_plan(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Depozitul „drills": imaginile secțiunilor, <club>/<fișier>
-- Le citește staff-ul clubului; le scrie orice membru al staff-ului (rândul din drills decide ce se vede).
-- ---------------------------------------------------------------------------
create or replace function private.drill_file_access(p_path text, p_action text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when not private.is_club_staff() then false
    when p_action = 'write' then true
    when p_action = 'read' then exists (select 1 from public.drills d where p_path = any (d.image_paths) and d.club_id = private.my_club()
                                          and (d.visibility = 'club' or d.created_by = app_auth.uid() or private.is_office()))
                             -- imaginea abia încărcată, înainte ca secțiunea să fie salvată
                             or not exists (select 1 from public.drills d where p_path = any (d.image_paths))
    else exists (select 1 from public.drills d where p_path = any (d.image_paths) and d.club_id = private.my_club()
                   and (d.created_by = app_auth.uid() or private.is_office()))
         or not exists (select 1 from public.drills d where p_path = any (d.image_paths))
  end
$$;
revoke all on function private.drill_file_access(text, text) from public;
grant execute on function private.drill_file_access(text, text) to authenticated;

do $$
declare v_src text;
begin
  select pg_get_functiondef('private.file_access_lr(text, text, text, uuid, public.app_role)'::regprocedure) into v_src;
  if position('drill_file_access' in v_src) = 0 then
    v_src := replace(v_src, E'  end if;\n  return false;\nend', E'  elsif p_bucket = ''drills'' then\n    if p_owner is distinct from (select private.my_club()) then return false; end if;\n    return private.drill_file_access(p_path, p_action);\n  end if;\n  return false;\nend');
    if position('drill_file_access' in v_src) = 0 then raise exception 'file_access_lr: punctul de inserare nu a fost găsit'; end if;
    execute v_src;
  end if;
end $$;

-- public.file_access trimite depozitele Locker Room către file_access_lr: „drills" intră în listă
do $$
declare v_src text;
begin
  select pg_get_functiondef('public.file_access(text, text, text)'::regprocedure) into v_src;
  if position('''drills''' in v_src) = 0 then
    v_src := replace(v_src, $r$'shop', 'site', 'messages') then$r$, $r$'shop', 'site', 'messages', 'drills') then$r$);
    if position('''drills''' in v_src) = 0 then raise exception 'file_access: lista depozitelor nu a fost găsită'; end if;
    execute v_src;
  end if;
end $$;
