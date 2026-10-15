-- Locker Room · Faza 4 · Club: suporteri — redirecționarea a 3,5% din impozit (Formularul 230) și sponsorii.
--
-- Formularul 230: vizitatorul îl completează pe site și primește PDF-ul gata de semnat. CNP-ul și adresa NU se
-- păstrează: intră doar în PDF-ul generat în memorie. Clubul ține evidența campaniei: cine a cerut formularul
-- (nume, contact dacă a fost de acord), cine l-a adus semnat, cine a fost depus la ANAF.
-- Sponsorii: evidența contractelor de sponsorizare (sumă, perioadă, stare) și, opțional, sigla pe site.

create or replace function private.can_manage_supporters() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.my_role()) in ('admin', 'secretary', 'accountant'), false)
$$;
grant execute on function private.can_manage_supporters() to authenticated;

create table public.support_campaigns (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  income_year smallint not null check (income_year between 2020 and 2100),
  title       text not null check (length(title) between 3 and 120),
  goal        int check (goal between 1 and 100000),
  deadline    date,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (club_id, income_year)
);

create table public.support_pledges (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  campaign_id  uuid not null references public.support_campaigns(id) on delete cascade,
  full_name    text not null check (length(full_name) between 3 and 160),
  email        text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone        text check (length(phone) between 6 and 20),
  two_years    boolean not null default false,
  source       text not null check (source in ('public', 'office')),
  status       text not null default 'started' check (status in ('started', 'received', 'submitted')),
  notes        text check (length(notes) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index support_pledges_campaign_idx on public.support_pledges (campaign_id, status, created_at desc);

create table public.sponsors (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  name          text not null check (length(name) between 2 and 160),
  fiscal_code   text check (length(fiscal_code) <= 20),
  contact_name  text check (length(contact_name) <= 120),
  email         text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone         text check (length(phone) between 6 and 20),
  kind          text not null default 'money' check (kind in ('money', 'goods', 'services')),
  amount        bigint check (amount between 0 and 10000000000),
  status        text not null default 'prospect' check (status in ('prospect', 'negotiating', 'signed', 'paid', 'ended')),
  starts_on     date,
  ends_on       date,
  tier          text not null default 'partner' check (tier in ('main', 'partner', 'supporter')),
  url           text check (url ~ '^https://'),
  logo_path     text,
  show_on_site  boolean not null default false,
  notes         text check (length(notes) <= 2000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index sponsors_club_idx on public.sponsors (club_id, status);

alter table public.support_campaigns enable row level security;
alter table public.support_pledges enable row level security;
alter table public.sponsors enable row level security;
create policy support_campaigns_select on public.support_campaigns for select to authenticated
  using (club_id = (select private.my_club()) and (select private.can_manage_supporters()));
create policy support_pledges_select on public.support_pledges for select to authenticated
  using (club_id = (select private.my_club()) and (select private.can_manage_supporters()));
create policy sponsors_select on public.sponsors for select to authenticated
  using (club_id = (select private.my_club()) and (select private.can_manage_supporters()));
grant select on public.support_campaigns, public.support_pledges, public.sponsors to authenticated;

create or replace function public.save_campaign(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := nullif(p->>'id', '')::uuid;
begin
  if not private.can_manage_supporters() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  if v_id is null then
    insert into public.support_campaigns (club_id, income_year, title, goal, deadline, is_active)
    values (private.my_club(), (p->>'income_year')::smallint, trim(p->>'title'), nullif(p->>'goal', '')::int, nullif(p->>'deadline', '')::date, coalesce((p->>'is_active')::boolean, true))
    returning id into v_id;
  else
    update public.support_campaigns set title = trim(p->>'title'), goal = nullif(p->>'goal', '')::int, deadline = nullif(p->>'deadline', '')::date,
      is_active = coalesce((p->>'is_active')::boolean, is_active)
    where id = v_id and club_id = private.my_club();
    if not found then raise exception 'Campania nu a fost găsită.' using errcode = 'P0002'; end if;
  end if;
  -- o singură campanie activă: cea salvată acum
  if coalesce((p->>'is_active')::boolean, true) then
    update public.support_campaigns set is_active = false where club_id = private.my_club() and id <> v_id;
  end if;
  return v_id;
end $$;

/** Formular 230 de pe site: se păstrează doar numele și, cu acord, contactul. Limitat pe IP. */
create or replace function public.record_support_pledge(p_slug text, p jsonb, p_ip text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.club_by_slug(p_slug); v_c record; v_fs record; v_keep boolean := coalesce((p->>'keep_contact')::boolean, false);
begin
  if v_club is null then raise exception 'Clubul nu a fost găsit.' using errcode = 'P0002'; end if;
  select * into v_c from public.support_campaigns where club_id = v_club and is_active;
  if not found then raise exception 'Campania de redirecționare nu este deschisă.' using errcode = '22023'; end if;
  select * into v_fs from public.finance_settings where club_id = v_club;
  if v_fs.fiscal_code is null or v_fs.iban is null then raise exception 'Clubul nu și-a completat datele fiscale.' using errcode = '22023'; end if;
  if length(trim(coalesce(p->>'full_name', ''))) < 3 then raise exception 'Scrie numele.' using errcode = '22023'; end if;
  if not private.public_hit(v_club, 'support230', p_ip, 10, 2000) then
    raise exception 'Prea multe trimiteri. Încearcă din nou peste o oră.' using errcode = '54000';
  end if;
  insert into public.support_pledges (club_id, campaign_id, full_name, email, phone, two_years, source)
  values (v_club, v_c.id, trim(p->>'full_name'),
          case when v_keep then nullif(lower(trim(p->>'email')), '') end,
          case when v_keep then nullif(regexp_replace(coalesce(p->>'phone', ''), '[^0-9+]', '', 'g'), '') end,
          coalesce((p->>'two_years')::boolean, false), 'public');
  perform private.notify_users(v_club, array['admin', 'secretary', 'accountant']::public.app_role[], 'supporters',
    'Formulare 230 noi azi', v_c.title, '/club/suporteri', 'support230:' || v_c.id || ':' || to_char(now(), 'YYYYMMDD'));
  return jsonb_build_object('name', coalesce(nullif(trim(v_fs.beneficiary), ''), (select name from public.clubs where id = v_club)),
                            'fiscal_code', v_fs.fiscal_code, 'iban', v_fs.iban, 'income_year', v_c.income_year);
end $$;
grant execute on function public.record_support_pledge(text, jsonb, text) to anon, authenticated;

-- p = { id?, full_name, email?, phone?, two_years, status, notes? }
create or replace function public.save_pledge(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := nullif(p->>'id', '')::uuid; v_c uuid;
begin
  if not private.can_manage_supporters() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  if v_id is null then
    select id into v_c from public.support_campaigns where club_id = private.my_club() and (id = nullif(p->>'campaign_id', '')::uuid or (nullif(p->>'campaign_id', '') is null and is_active)) limit 1;
    if v_c is null then raise exception 'Creează întâi campania anului.' using errcode = '22023'; end if;
    insert into public.support_pledges (club_id, campaign_id, full_name, email, phone, two_years, source, status, notes)
    values (private.my_club(), v_c, trim(p->>'full_name'), nullif(lower(trim(p->>'email')), ''), nullif(trim(p->>'phone'), ''),
            coalesce((p->>'two_years')::boolean, false), 'office', coalesce(nullif(p->>'status', ''), 'received'), nullif(trim(p->>'notes'), ''))
    returning id into v_id;
  else
    update public.support_pledges set full_name = coalesce(nullif(trim(p->>'full_name'), ''), full_name),
      email = case when p ? 'email' then nullif(lower(trim(p->>'email')), '') else email end,
      phone = case when p ? 'phone' then nullif(trim(p->>'phone'), '') else phone end,
      two_years = coalesce((p->>'two_years')::boolean, two_years), status = coalesce(nullif(p->>'status', ''), status),
      notes = case when p ? 'notes' then nullif(trim(p->>'notes'), '') else notes end, updated_at = now()
    where id = v_id and club_id = private.my_club();
    if not found then raise exception 'Formularul nu a fost găsit.' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.set_pledges_status(p_ids uuid[], p_status text) returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  if not private.can_manage_supporters() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  if p_status not in ('started', 'received', 'submitted') then raise exception 'Stare invalidă.' using errcode = '22023'; end if;
  update public.support_pledges set status = p_status, updated_at = now() where id = any (p_ids) and club_id = private.my_club();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.delete_pledge(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_supporters() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  delete from public.support_pledges where id = p_id and club_id = private.my_club();
end $$;

-- p = { id?, name, fiscal_code?, contact_name?, email?, phone?, kind, amount?, status, starts_on?, ends_on?, tier, url?, logo_path?, show_on_site, notes? }
create or replace function public.save_sponsor(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); v_id uuid := nullif(p->>'id', '')::uuid; v_logo text := nullif(p->>'logo_path', '');
begin
  if not private.can_manage_supporters() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  if v_logo is not null and v_logo not like v_club::text || '/sponsor/%' then v_logo := null; end if;
  if v_id is null then
    insert into public.sponsors (club_id, name) values (v_club, trim(p->>'name')) returning id into v_id;
  end if;
  update public.sponsors set name = trim(p->>'name'), fiscal_code = nullif(trim(p->>'fiscal_code'), ''), contact_name = nullif(trim(p->>'contact_name'), ''),
    email = nullif(lower(trim(p->>'email')), ''), phone = nullif(trim(p->>'phone'), ''), kind = coalesce(nullif(p->>'kind', ''), 'money'),
    amount = nullif(p->>'amount', '')::bigint, status = coalesce(nullif(p->>'status', ''), 'prospect'),
    starts_on = nullif(p->>'starts_on', '')::date, ends_on = nullif(p->>'ends_on', '')::date, tier = coalesce(nullif(p->>'tier', ''), 'partner'),
    url = nullif(trim(p->>'url'), ''), logo_path = v_logo, show_on_site = coalesce((p->>'show_on_site')::boolean, false),
    notes = nullif(trim(p->>'notes'), ''), updated_at = now()
  where id = v_id and club_id = v_club;
  if not found then raise exception 'Sponsorul nu a fost găsit.' using errcode = 'P0002'; end if;
  return v_id;
end $$;

create or replace function public.delete_sponsor(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_logo text;
begin
  if not private.can_manage_supporters() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  delete from public.sponsors where id = p_id and club_id = private.my_club() returning logo_path into v_logo;
  return v_logo;
end $$;

grant execute on function public.save_campaign(jsonb), public.save_pledge(jsonb), public.set_pledges_status(uuid[], text),
  public.delete_pledge(uuid), public.save_sponsor(jsonb), public.delete_sponsor(uuid) to authenticated;

/** Pagina publică „Susține clubul": campania activă (fără nume), datele fiscale și sponsorii aleși pentru site. */
create or replace function public.public_support(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with c as (select id, name from public.clubs where slug = lower(trim(p_slug)))
  select jsonb_build_object(
    'beneficiary', coalesce(nullif(trim(fs.beneficiary), ''), c.name), 'fiscal_code', fs.fiscal_code, 'iban', fs.iban,
    'campaign', (select jsonb_build_object('income_year', sc.income_year, 'title', sc.title, 'deadline', sc.deadline)
                 from public.support_campaigns sc where sc.club_id = c.id and sc.is_active),
    'sponsors', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'tier', s.tier, 'url', s.url, 'logo_path', s.logo_path)
                          order by case s.tier when 'main' then 0 when 'partner' then 1 else 2 end, s.name)
                          from public.sponsors s where s.club_id = c.id and s.show_on_site and s.status in ('signed', 'paid')), '[]'::jsonb))
  from c left join public.finance_settings fs on fs.club_id = c.id
$$;
grant execute on function public.public_support(text) to anon, authenticated;

-- siglele sponsorilor: depozitul „site" (<club>/sponsor/…), servite public dacă sponsorul e afișat
create or replace function public.site_public_file(p_slug text, p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.site_posts p where p.club_id = private.club_by_slug(p_slug) and p.status = 'published' and p.to_site
                   and (p.cover_path = p_path or p.blocks @> jsonb_build_array(jsonb_build_object('path', p_path))))
      or exists (select 1 from public.site_photos ph where ph.club_id = private.club_by_slug(p_slug) and ph.path = p_path and private.photo_is_public(ph.id))
      or exists (select 1 from public.sponsors s where s.club_id = private.club_by_slug(p_slug) and s.logo_path = p_path
                   and s.show_on_site and s.status in ('signed', 'paid'))
$$;

create or replace function private.site_file_access(p_path text, p_action text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when private.can_manage_website() and split_part(p_path, '/', 2) in ('post', 'foto') then true
    when private.can_manage_supporters() and split_part(p_path, '/', 2) = 'sponsor' then true
    when p_action = 'delete' then exists (select 1 from public.site_photos ph, unnest(ph.player_ids) pid
                                          where ph.path = p_path and private.can_manage_player(pid))
    when p_action <> 'read' then false
    when private.can_manage_website() then split_part(p_path, '/', 2) in ('post', 'foto', 'sponsor')
    else exists (select 1 from public.site_posts p where p.cover_path = p_path or p.blocks @> jsonb_build_array(jsonb_build_object('path', p_path)))
  end
$$;
