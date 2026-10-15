-- Locker Room faza 4 · Teste fizice pe baterii (grilă jucători × teste) și evaluările jucătorilor
-- (model pe grupă de vârstă, rundă pornită de director, notare pe telefon, publicare către familie).

-- ===========================================================================
-- Baterii de teste
-- ===========================================================================
create table public.fitness_batteries (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  name        text not null check (length(trim(name)) between 2 and 80),
  description text,
  sort        int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create table public.fitness_battery_tests (
  battery_id uuid not null references public.fitness_batteries(id) on delete cascade,
  test_id    uuid not null references public.fitness_tests(id) on delete cascade,
  sort       int not null default 0,
  primary key (battery_id, test_id)
);
alter table public.fitness_tests add column if not exists description text;

alter table public.fitness_batteries enable row level security;
alter table public.fitness_battery_tests enable row level security;
create policy fitness_batteries_select on public.fitness_batteries for select to authenticated
  using (club_id = (select private.my_club()));
create policy fitness_batteries_write on public.fitness_batteries for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_physio()))
  with check (club_id = (select private.my_club()) and (select private.is_physio()));
create policy fitness_battery_tests_select on public.fitness_battery_tests for select to authenticated
  using (exists (select 1 from public.fitness_batteries b where b.id = battery_id and b.club_id = (select private.my_club())));
create policy fitness_battery_tests_write on public.fitness_battery_tests for all to authenticated
  using ((select private.is_physio()) and exists (select 1 from public.fitness_batteries b where b.id = battery_id and b.club_id = (select private.my_club())))
  with check ((select private.is_physio()) and exists (select 1 from public.fitness_batteries b where b.id = battery_id and b.club_id = (select private.my_club()))
              and private.test_club(test_id) = (select private.my_club()));
grant select, insert, update, delete on public.fitness_batteries, public.fitness_battery_tests to authenticated;
grant select (description), insert (description), update (description) on public.fitness_tests to authenticated;

create trigger fitness_batteries_audit after insert or update or delete on public.fitness_batteries
  for each row execute function private.audit();

/**
 * Bateria standard: testele lipsă se creează (după cod), apoi bateria cu ordinea dată.
 *   p = { name, description?, tests: [{ code, name, unit, lower_is_better, description? }] }
 */
create or replace function public.create_fitness_battery(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); v_id uuid; t jsonb; v_test uuid; v_pos int := 0;
begin
  if not private.is_physio() then raise exception 'Doar preparatorul fizic configurează testele.' using errcode = '42501'; end if;
  if nullif(trim(p->>'name'), '') is null or jsonb_array_length(coalesce(p->'tests', '[]'::jsonb)) = 0 then
    raise exception 'Bateria are nevoie de un nume și de cel puțin un test.' using errcode = '22023';
  end if;
  insert into public.fitness_batteries (club_id, name, description, sort)
  values (v_club, trim(p->>'name'), nullif(trim(p->>'description'), ''),
          coalesce((select max(sort) + 1 from public.fitness_batteries where club_id = v_club), 0))
  returning id into v_id;
  for t in select * from jsonb_array_elements(p->'tests') loop
    v_pos := v_pos + 1;
    if t ? 'id' then
      select ft.id into v_test from public.fitness_tests ft where ft.id = (t->>'id')::uuid and ft.club_id = v_club;
    else
      select ft.id into v_test from public.fitness_tests ft where ft.club_id = v_club and ft.code = t->>'code';
      if v_test is null then
        insert into public.fitness_tests (club_id, code, name, unit, lower_is_better, description, sort)
        values (v_club, t->>'code', t->>'name', t->>'unit', coalesce((t->>'lower_is_better')::boolean, false), t->>'description',
                coalesce((select max(sort) + 1 from public.fitness_tests where club_id = v_club), 0))
        returning id into v_test;
      else
        update public.fitness_tests set is_active = true where id = v_test;
      end if;
    end if;
    if v_test is null then raise exception 'Testul nu a fost găsit.' using errcode = 'P0002'; end if;
    insert into public.fitness_battery_tests (battery_id, test_id, sort) values (v_id, v_test, v_pos) on conflict do nothing;
  end loop;
  return v_id;
end $$;

/**
 * Grila unei testări: jucători × teste, o zi. Valoarea goală șterge rezultatul zilei.
 *   p_rows = [{ player_id, test_id, value | null }]
 */
create or replace function public.save_test_grid(p_date date, p_rows jsonb) returns int
language plpgsql security invoker set search_path = '' as $$
declare r jsonb; v_n int := 0; v_val numeric;
begin
  if p_date is null or p_date > private.club_today() then
    raise exception 'Data testării nu poate fi în viitor.' using errcode = '22023';
  end if;
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    if not private.can_manage_player((r->>'player_id')::uuid) then
      raise exception 'Doar preparatorul fizic introduce rezultatele.' using errcode = '42501';
    end if;
    if private.test_club((r->>'test_id')::uuid) is distinct from private.my_club() then
      raise exception 'Testul nu a fost găsit.' using errcode = 'P0002';
    end if;
    v_val := nullif(r->>'value', '')::numeric;
    if v_val is null then
      delete from public.fitness_test_results
      where test_id = (r->>'test_id')::uuid and player_id = (r->>'player_id')::uuid and tested_on = p_date;
    else
      insert into public.fitness_test_results (test_id, player_id, tested_on, value, created_by)
      values ((r->>'test_id')::uuid, (r->>'player_id')::uuid, p_date, v_val, app_auth.uid())
      on conflict (test_id, player_id, tested_on) do update set value = excluded.value;
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
grant execute on function public.create_fitness_battery(jsonb), public.save_test_grid(date, jsonb) to authenticated;

-- ===========================================================================
-- Evaluări
-- ===========================================================================
/** Directorul sportiv și preparatorul configurează modelele, pornesc și publică rundele. */
create or replace function private.can_manage_evaluations() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.my_role()) in ('sporting_director', 'physio'), false)
$$;
/** Cine notează un jucător: directorul, preparatorul sau antrenorul echipei lui. */
create or replace function private.can_evaluate(p_player uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.players pl
    where pl.id = p_player and pl.club_id = private.my_club()
      and (private.can_manage_evaluations()
           or (private.my_role() = 'coach' and pl.group_id = any (private.my_group_ids())))
  )
$$;
grant execute on function private.can_manage_evaluations(), private.can_evaluate(uuid) to authenticated;

create table public.evaluation_templates (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  name        text not null check (length(trim(name)) between 2 and 80),
  age_label   text,                 -- „U12–U15", doar informativ
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create table public.evaluation_criteria (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.evaluation_templates(id) on delete cascade,
  category    text not null check (category in ('technical', 'tactical', 'physical', 'mental')),
  name        text not null check (length(trim(name)) between 2 and 80),
  description text,
  sort        int not null default 0,
  is_active   boolean not null default true
);
create index evaluation_criteria_template_idx on public.evaluation_criteria (template_id, sort);

create table public.evaluation_rounds (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  template_id  uuid not null references public.evaluation_templates(id) on delete restrict,
  name         text not null check (length(trim(name)) between 2 and 80),
  due_on       date,
  status       text not null default 'open' check (status in ('open', 'published')),
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  published_at timestamptz,
  published_by uuid references public.profiles(id) on delete set null
);
create table public.evaluation_round_groups (
  round_id uuid not null references public.evaluation_rounds(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  primary key (round_id, group_id)
);
create table public.evaluations (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid not null references public.evaluation_rounds(id) on delete cascade,
  player_id    uuid not null references public.players(id) on delete cascade,
  evaluator_id uuid references public.profiles(id) on delete set null,
  status       text not null default 'draft' check (status in ('draft', 'submitted')),
  strengths    text,
  next_goals   text,
  comment      text,               -- nota internă a staff-ului; NU se publică familiei
  updated_at   timestamptz not null default now(),
  submitted_at timestamptz,
  unique (round_id, player_id)
);
create index evaluations_player_idx on public.evaluations (player_id);
create table public.evaluation_scores (
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  criterion_id  uuid not null references public.evaluation_criteria(id) on delete cascade,
  score         smallint not null check (score between 1 and 5),
  primary key (evaluation_id, criterion_id)
);

create or replace function private.round_club(p_round uuid) returns uuid
language sql stable security definer set search_path = '' as $$ select r.club_id from public.evaluation_rounds r where r.id = p_round $$;
create or replace function private.round_published(p_round uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select coalesce((select r.status = 'published' from public.evaluation_rounds r where r.id = p_round), false) $$;
/** O evaluare vizibilă: cine notează, sau familia / jucătorul după publicare (doar cele trimise). */
create or replace function private.can_see_evaluation(p_eval uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.evaluations e
    where e.id = p_eval
      and (private.can_evaluate(e.player_id)
           or (e.status = 'submitted' and private.round_published(e.round_id)
               and e.player_id = any (private.my_player_ids())))
  )
$$;
grant execute on function private.round_club(uuid), private.round_published(uuid), private.can_see_evaluation(uuid) to authenticated;

alter table public.evaluation_templates enable row level security;
alter table public.evaluation_criteria enable row level security;
alter table public.evaluation_rounds enable row level security;
alter table public.evaluation_round_groups enable row level security;
alter table public.evaluations enable row level security;
alter table public.evaluation_scores enable row level security;

-- modelele și criteriile: tot clubul le poate citi (familia vede numele criteriilor din evaluarea publicată)
create policy evaluation_templates_select on public.evaluation_templates for select to authenticated
  using (club_id = (select private.my_club()));
create policy evaluation_criteria_select on public.evaluation_criteria for select to authenticated
  using (exists (select 1 from public.evaluation_templates t where t.id = template_id and t.club_id = (select private.my_club())));
create policy evaluation_rounds_select on public.evaluation_rounds for select to authenticated
  using (club_id = (select private.my_club())
     and ((select private.my_role()) in ('sporting_director', 'physio', 'coach')
          or (status = 'published' and exists (select 1 from public.evaluations e where e.round_id = evaluation_rounds.id and e.status = 'submitted'
                                                  and e.player_id = any ((select private.my_player_ids())::uuid[])))));
create policy evaluation_round_groups_select on public.evaluation_round_groups for select to authenticated
  using (private.round_club(round_id) = (select private.my_club()) and (select private.my_role()) in ('sporting_director', 'physio', 'coach'));
create policy evaluations_select on public.evaluations for select to authenticated
  using (private.can_see_evaluation(id));
create policy evaluation_scores_select on public.evaluation_scores for select to authenticated
  using (private.can_see_evaluation(evaluation_id));
grant select on public.evaluation_templates, public.evaluation_criteria, public.evaluation_rounds, public.evaluation_round_groups,
  public.evaluation_scores to authenticated;
-- nota internă (comment) nu ajunge la familie: coloana se citește doar prin funcția de mai jos
grant select (id, round_id, player_id, evaluator_id, status, strengths, next_goals, updated_at, submitted_at) on public.evaluations to authenticated;

create or replace function public.evaluation_comment(p_eval uuid) returns text
language sql stable security definer set search_path = '' as $$
  select e.comment from public.evaluations e where e.id = p_eval and private.can_evaluate(e.player_id)
$$;
grant execute on function public.evaluation_comment(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['evaluation_templates', 'evaluation_rounds', 'evaluations'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit()', t || '_audit', t);
  end loop;
end $$;

/**
 * Model de evaluare (creare sau modificare).
 *   p = { id?, name, age_label?, criteria: [{ id?, category, name, description? }] }
 * Criteriile scoase din listă se dezactivează (notele vechi rămân).
 */
create or replace function public.save_evaluation_template(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); v_id uuid := nullif(p->>'id', '')::uuid; c jsonb; v_pos int := 0; v_keep uuid[] := '{}'; v_cid uuid;
begin
  if not private.can_manage_evaluations() then raise exception 'Doar directorul sportiv sau preparatorul configurează evaluările.' using errcode = '42501'; end if;
  if nullif(trim(p->>'name'), '') is null or jsonb_array_length(coalesce(p->'criteria', '[]'::jsonb)) = 0 then
    raise exception 'Modelul are nevoie de un nume și de cel puțin un criteriu.' using errcode = '22023';
  end if;
  if v_id is null then
    insert into public.evaluation_templates (club_id, name, age_label) values (v_club, trim(p->>'name'), nullif(trim(p->>'age_label'), '')) returning id into v_id;
  else
    update public.evaluation_templates set name = trim(p->>'name'), age_label = nullif(trim(p->>'age_label'), '')
    where id = v_id and club_id = v_club;
    if not found then raise exception 'Modelul nu a fost găsit.' using errcode = 'P0002'; end if;
  end if;
  for c in select * from jsonb_array_elements(p->'criteria') loop
    v_pos := v_pos + 1;
    v_cid := nullif(c->>'id', '')::uuid;
    if v_cid is not null and exists (select 1 from public.evaluation_criteria x where x.id = v_cid and x.template_id = v_id) then
      update public.evaluation_criteria set category = c->>'category', name = trim(c->>'name'), description = nullif(trim(c->>'description'), ''),
        sort = v_pos, is_active = true where id = v_cid;
    else
      insert into public.evaluation_criteria (template_id, category, name, description, sort)
      values (v_id, c->>'category', trim(c->>'name'), nullif(trim(c->>'description'), ''), v_pos) returning id into v_cid;
    end if;
    v_keep := v_keep || v_cid;
  end loop;
  update public.evaluation_criteria set is_active = false where template_id = v_id and id <> all (v_keep);
  return v_id;
end $$;

/** Runda: un model, una sau mai multe echipe, un termen. Antrenorii echipelor sunt anunțați. */
create or replace function public.start_evaluation_round(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); v_id uuid; v_groups uuid[]; v_user uuid; v_name text := trim(p->>'name');
begin
  if not private.can_manage_evaluations() then raise exception 'Doar directorul sportiv sau preparatorul pornește evaluările.' using errcode = '42501'; end if;
  select array_agg(g.id) into v_groups from public.groups g
  where g.club_id = v_club and g.id::text in (select jsonb_array_elements_text(coalesce(p->'group_ids', '[]'::jsonb)));
  if v_groups is null or nullif(v_name, '') is null then raise exception 'Alege echipele și numele rundei.' using errcode = '22023'; end if;
  if not exists (select 1 from public.evaluation_templates t where t.id = (p->>'template_id')::uuid and t.club_id = v_club and t.is_active) then
    raise exception 'Modelul nu a fost găsit.' using errcode = 'P0002';
  end if;
  insert into public.evaluation_rounds (club_id, template_id, name, due_on, created_by)
  values (v_club, (p->>'template_id')::uuid, v_name, nullif(p->>'due_on', '')::date, app_auth.uid()) returning id into v_id;
  insert into public.evaluation_round_groups (round_id, group_id) select v_id, unnest(v_groups);
  for v_user in select distinct sg.user_id from public.staff_groups sg join public.profiles pr on pr.id = sg.user_id and pr.is_active and pr.role = 'coach'
                where sg.group_id = any (v_groups) and sg.user_id is distinct from app_auth.uid() loop
    perform private.notify(v_user, 'evaluation_round', 'Evaluări de completat: ' || v_name,
      coalesce('Termen: ' || to_char(nullif(p->>'due_on', '')::date, 'DD.MM.YYYY'), null), '/performanta/evaluari/' || v_id, 'eval_round:' || v_id);
  end loop;
  return v_id;
end $$;

/**
 * Notarea unui jucător într-o rundă deschisă.
 *   p_scores = { "<criteriu>": 1..5, … }; p_submit = true marchează evaluarea trimisă (gata de publicat).
 */
create or replace function public.save_evaluation(
  p_round uuid, p_player uuid, p_scores jsonb, p_strengths text default null, p_next_goals text default null,
  p_comment text default null, p_submit boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_round record; v_id uuid; k text; v_template uuid; v_missing int;
begin
  select r.* into v_round from public.evaluation_rounds r where r.id = p_round and r.club_id = private.my_club();
  if not found then raise exception 'Runda nu a fost găsită.' using errcode = 'P0002'; end if;
  if v_round.status <> 'open' then raise exception 'Runda a fost publicată; evaluările nu se mai modifică.' using errcode = '22023'; end if;
  if not private.can_evaluate(p_player) then raise exception 'Nu poți evalua acest jucător.' using errcode = '42501'; end if;
  if not exists (select 1 from public.players pl join public.evaluation_round_groups rg on rg.group_id = pl.group_id and rg.round_id = p_round
                 where pl.id = p_player) then
    raise exception 'Jucătorul nu face parte din echipele rundei.' using errcode = '22023';
  end if;
  v_template := v_round.template_id;
  for k in select jsonb_object_keys(coalesce(p_scores, '{}'::jsonb)) loop
    if not exists (select 1 from public.evaluation_criteria c where c.id = k::uuid and c.template_id = v_template and c.is_active) then
      raise exception 'Criteriu necunoscut.' using errcode = '22023';
    end if;
    if (p_scores->>k) is not null and ((p_scores->>k)::int not between 1 and 5) then
      raise exception 'Notele sunt de la 1 la 5.' using errcode = '22023';
    end if;
  end loop;
  if p_submit then
    select count(*) into v_missing from public.evaluation_criteria c
    where c.template_id = v_template and c.is_active and coalesce(p_scores->>(c.id::text), '') = '';
    if v_missing > 0 then raise exception 'Notează toate criteriile înainte de trimitere.' using errcode = '22023'; end if;
  end if;
  insert into public.evaluations (round_id, player_id, evaluator_id, status, strengths, next_goals, comment, updated_at, submitted_at)
  values (p_round, p_player, app_auth.uid(), case when p_submit then 'submitted' else 'draft' end,
          nullif(left(trim(p_strengths), 1000), ''), nullif(left(trim(p_next_goals), 1000), ''), nullif(left(trim(p_comment), 2000), ''),
          now(), case when p_submit then now() end)
  on conflict (round_id, player_id) do update set
    evaluator_id = excluded.evaluator_id,
    status = case when p_submit then 'submitted' else public.evaluations.status end,
    strengths = excluded.strengths, next_goals = excluded.next_goals, comment = excluded.comment, updated_at = now(),
    submitted_at = case when p_submit then now() else public.evaluations.submitted_at end
  returning id into v_id;
  delete from public.evaluation_scores where evaluation_id = v_id;
  insert into public.evaluation_scores (evaluation_id, criterion_id, score)
  select v_id, key::uuid, value::text::int from jsonb_each(coalesce(p_scores, '{}'::jsonb)) where jsonb_typeof(value) = 'number';
  return v_id;
end $$;

/** Publicarea: familiile și jucătorii văd evaluările trimise (fără nota internă). */
create or replace function public.publish_evaluation_round(p_round uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare v_round record; r record; v_user uuid; v_n int := 0;
begin
  if not private.can_manage_evaluations() then raise exception 'Doar directorul sportiv sau preparatorul publică evaluările.' using errcode = '42501'; end if;
  select * into v_round from public.evaluation_rounds where id = p_round and club_id = private.my_club() for update;
  if not found then raise exception 'Runda nu a fost găsită.' using errcode = 'P0002'; end if;
  if v_round.status = 'published' then raise exception 'Runda este deja publicată.' using errcode = '22023'; end if;
  if not exists (select 1 from public.evaluations e where e.round_id = p_round and e.status = 'submitted') then
    raise exception 'Nicio evaluare trimisă încă.' using errcode = '22023';
  end if;
  update public.evaluation_rounds set status = 'published', published_at = now(), published_by = app_auth.uid() where id = p_round;
  for r in select e.id, e.player_id, pl.display_name from public.evaluations e join public.players pl on pl.id = e.player_id
           where e.round_id = p_round and e.status = 'submitted' loop
    for v_user in select * from private.visa_reminder_targets(r.player_id) loop
      perform private.notify(v_user, 'evaluation_published', 'Evaluare nouă: ' || r.display_name, v_round.name, '/evaluari/' || r.id, 'eval_pub:' || r.id || ':' || v_user);
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end $$;

/** O rundă fără nicio evaluare se poate șterge (pornită din greșeală). */
create or replace function public.delete_evaluation_round(p_round uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_evaluations() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  if exists (select 1 from public.evaluations e where e.round_id = p_round) then
    raise exception 'Runda are deja evaluări și nu se mai poate șterge.' using errcode = '22023';
  end if;
  delete from public.evaluation_rounds where id = p_round and club_id = private.my_club();
end $$;

grant execute on function public.save_evaluation_template(jsonb), public.start_evaluation_round(jsonb),
  public.save_evaluation(uuid, uuid, jsonb, text, text, text, boolean), public.publish_evaluation_round(uuid),
  public.delete_evaluation_round(uuid) to authenticated;

-- GDPR: evaluările jucătorului dispar la anonimizare (notele sunt despre persoană)
create or replace function private.scrub_player_lr(p_player uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.visa_documents where player_id = p_player;
  delete from public.evaluations where player_id = p_player;
  delete from public.notifications n
  where coalesce(p_name, '') <> '' and n.kind in ('visa_document', 'visa_reminder', 'evaluation_published') and n.title like '%' || p_name || '%';
end $$;
