-- Locker Room faza 4 · Club › Mesaje: mesaje către părinți, jucători și staff, pe echipe, cu lista destinatarilor
-- văzută înainte de trimitere, programare, șabloane și cine a citit.

create table public.message_templates (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  name       text not null check (length(trim(name)) between 2 and 80),
  title      text not null check (length(trim(title)) between 2 and 140),
  body       text not null check (length(body) <= 5000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references public.clubs(id) on delete cascade,
  author_id       uuid references public.profiles(id) on delete set null,
  title           text not null check (length(trim(title)) between 2 and 140),
  body            text not null check (length(trim(body)) between 1 and 5000),
  -- { audiences: ['guardians' | 'players' | 'coaches' | 'staff'], group_ids: [uuid], exclude_user_ids: [uuid] }
  audience        jsonb not null,
  status          text not null default 'scheduled' check (status in ('scheduled', 'sent', 'cancelled')),
  scheduled_at    timestamptz not null default now(),
  sent_at         timestamptz,
  recipient_count int not null default 0,
  created_at      timestamptz not null default now()
);
create index messages_club_idx on public.messages (club_id, created_at desc);
create index messages_due_idx on public.messages (scheduled_at) where status = 'scheduled';

create table public.message_recipients (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text,                       -- numele la trimitere (biroul nu citește profilurile părinților)
  reason     text,                       -- „părinte · DRAGOMIR (U17)"
  read_at    timestamptz,
  primary key (message_id, user_id)
);
create index message_recipients_user_idx on public.message_recipients (user_id);

/** Cine trimite mesaje: biroul și directorul către tot clubul; preparatorul și antrenorul doar echipelor lor. */
create or replace function private.can_send_messages() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.my_role()) in ('admin', 'secretary', 'sporting_director', 'physio', 'coach'), false)
$$;
grant execute on function private.can_send_messages() to authenticated;

alter table public.message_templates enable row level security;
alter table public.messages enable row level security;
alter table public.message_recipients enable row level security;
create policy message_templates_select on public.message_templates for select to authenticated
  using (club_id = (select private.my_club()) and (select private.can_send_messages()));
create policy message_templates_write on public.message_templates for all to authenticated
  using (club_id = (select private.my_club()) and (select private.my_role()) in ('admin', 'secretary', 'sporting_director'))
  with check (club_id = (select private.my_club()) and (select private.my_role()) in ('admin', 'secretary', 'sporting_director'));
-- mesajele: autorul, biroul și directorul (toate), destinatarul (al lui). Verificările încrucișate trec prin funcții
-- (altfel politicile celor două tabele s-ar apela una pe alta la nesfârșit).
create or replace function private.is_message_recipient(p_message uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.message_recipients r where r.message_id = p_message and r.user_id = app_auth.uid())
$$;
create or replace function private.can_manage_message(p_message uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.messages m where m.id = p_message and m.club_id = private.my_club()
                   and (m.author_id = app_auth.uid() or private.my_role() in ('admin', 'secretary', 'sporting_director')))
$$;
grant execute on function private.is_message_recipient(uuid), private.can_manage_message(uuid) to authenticated;
create policy messages_select on public.messages for select to authenticated
  using (club_id = (select private.my_club())
     and (author_id = (select app_auth.uid())
          or (select private.my_role()) in ('admin', 'secretary', 'sporting_director')
          or (status = 'sent' and private.is_message_recipient(id))));
create policy message_recipients_select on public.message_recipients for select to authenticated
  using (user_id = (select app_auth.uid()) or private.can_manage_message(message_id));
grant select, insert, update, delete on public.message_templates to authenticated;
grant select on public.messages, public.message_recipients to authenticated;

create trigger messages_audit after insert or update or delete on public.messages
  for each row execute function private.audit();

-- ---------------------------------------------------------------------------
-- Publicul unui mesaj → conturi (o singură dată pe cont, cu motivul)
-- ---------------------------------------------------------------------------
create or replace function private.message_audience(p_club uuid, p_audience jsonb)
returns table (user_id uuid, full_name text, role public.app_role, reason text)
language sql stable security definer set search_path = '' as $$
  with g as (
    select x::uuid as id from jsonb_array_elements_text(coalesce(p_audience->'group_ids', '[]'::jsonb)) x
  ), aud as (
    select a from jsonb_array_elements_text(coalesce(p_audience->'audiences', '[]'::jsonb)) a
  ), excl as (
    select x::uuid as id from jsonb_array_elements_text(coalesce(p_audience->'exclude_user_ids', '[]'::jsonb)) x
  ), raw as (
    -- părinții copiilor din echipele alese
    select gu.user_id, gu.full_name, 'guardian'::public.app_role as role,
           'părinte · ' || string_agg(distinct pl.display_name || coalesce(' (' || gr.name || ')', ''), ', ') as reason
    from public.guardians gu
    join public.guardian_players gp on gp.guardian_id = gu.id
    join public.players pl on pl.id = gp.player_id and pl.is_active and pl.anonymized_at is null and pl.club_id = p_club
    left join public.groups gr on gr.id = pl.group_id
    where 'guardians' in (select a from aud) and gu.deleted_at is null and gu.user_id is not null and gu.club_id = p_club
      and (not exists (select 1 from g) or pl.group_id in (select id from g))
    group by gu.user_id, gu.full_name
    union all
    -- jucătorii cu cont
    select pl.user_id, pl.display_name, 'player', 'jucător' || coalesce(' · ' || gr.name, '')
    from public.players pl left join public.groups gr on gr.id = pl.group_id
    where 'players' in (select a from aud) and pl.club_id = p_club and pl.user_id is not null and pl.is_active and pl.anonymized_at is null
      and (not exists (select 1 from g) or pl.group_id in (select id from g))
    union all
    -- antrenorii echipelor alese
    select pr.id, pr.full_name, pr.role, 'antrenor · ' || string_agg(distinct gr.name, ', ')
    from public.staff_groups sg join public.profiles pr on pr.id = sg.user_id and pr.is_active and pr.role = 'coach' and pr.club_id = p_club
    join public.groups gr on gr.id = sg.group_id
    where 'coaches' in (select a from aud) and (not exists (select 1 from g) or sg.group_id in (select id from g))
    group by pr.id, pr.full_name, pr.role
    union all
    -- tot staff-ul clubului
    select pr.id, pr.full_name, pr.role, 'staff'
    from public.profiles pr
    where 'staff' in (select a from aud) and pr.club_id = p_club and pr.is_active
      and pr.role in ('admin', 'secretary', 'sporting_director', 'physio', 'coach', 'accountant', 'owner')
  )
  select distinct on (r.user_id) r.user_id, r.full_name, r.role, r.reason
  from raw r
  where r.user_id not in (select id from excl)
  order by r.user_id, case r.role when 'guardian' then 1 when 'player' then 2 else 3 end
$$;

/** Verifică publicul pentru expeditorul curent (antrenorul / preparatorul: doar echipele lor, fără „tot staff-ul"). */
create or replace function private.check_message_audience(p_audience jsonb) returns void
language plpgsql stable security definer set search_path = '' as $$
declare v_role public.app_role := private.my_role(); v_bad int;
begin
  if not private.can_send_messages() then raise exception 'Nu poți trimite mesaje.' using errcode = '42501'; end if;
  if jsonb_array_length(coalesce(p_audience->'audiences', '[]'::jsonb)) = 0 then
    raise exception 'Alege cui trimiți mesajul.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements_text(p_audience->'audiences') a where a not in ('guardians', 'players', 'coaches', 'staff')) then
    raise exception 'Public necunoscut.' using errcode = '22023';
  end if;
  select count(*) into v_bad from jsonb_array_elements_text(coalesce(p_audience->'group_ids', '[]'::jsonb)) x
  where private.group_club(x::uuid) is distinct from private.my_club();
  if v_bad > 0 then raise exception 'Echipă necunoscută.' using errcode = '22023'; end if;
  if v_role in ('coach', 'physio') then
    if p_audience->'audiences' ? 'staff' then raise exception 'Mesajele către tot staff-ul le trimite biroul.' using errcode = '42501'; end if;
    if v_role = 'coach' and (jsonb_array_length(coalesce(p_audience->'group_ids', '[]'::jsonb)) = 0
        or exists (select 1 from jsonb_array_elements_text(p_audience->'group_ids') x where x::uuid <> all (private.my_group_ids()))) then
      raise exception 'Antrenorul trimite mesaje doar echipelor lui.' using errcode = '42501';
    end if;
  end if;
end $$;

/** Lista destinatarilor, înainte de trimitere. */
create or replace function public.preview_message_audience(p_audience jsonb)
returns table (user_id uuid, full_name text, role public.app_role, reason text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.check_message_audience(p_audience);
  return query select * from private.message_audience(private.my_club(), p_audience) order by 2;
end $$;

create or replace function private.deliver_message(p_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare v_m record; v_n int;
begin
  select * into v_m from public.messages where id = p_id for update;
  if v_m.status <> 'scheduled' then return 0; end if;
  insert into public.message_recipients (message_id, user_id, name, reason)
  select p_id, a.user_id, a.full_name, a.reason from private.message_audience(v_m.club_id, v_m.audience) a
  on conflict do nothing;
  get diagnostics v_n = row_count;
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  select r.user_id, 'message', v_m.title, left(v_m.body, 180), '/mesaje/' || p_id, 'msg:' || p_id
  from public.message_recipients r where r.message_id = p_id
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  update public.messages set status = 'sent', sent_at = now(), recipient_count = v_n where id = p_id;
  return v_n;
end $$;

/**
 * Trimiterea (acum sau programată).
 *   p = { title, body, audience, scheduled_at? }; întoarce { id, recipients } (recipients = 0 dacă e programat)
 */
create or replace function public.send_message(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_when timestamptz := coalesce(nullif(p->>'scheduled_at', '')::timestamptz, now()); v_n int := 0;
begin
  perform private.check_message_audience(p->'audience');
  if v_when > now() + interval '90 days' then raise exception 'Programarea merge cel mult 90 de zile înainte.' using errcode = '22023'; end if;
  if not exists (select 1 from private.message_audience(private.my_club(), p->'audience')) then
    raise exception 'Niciun destinatar cu cont în aplicație.' using errcode = '22023';
  end if;
  insert into public.messages (club_id, author_id, title, body, audience, scheduled_at)
  values (private.my_club(), app_auth.uid(), trim(p->>'title'), trim(p->>'body'), p->'audience', greatest(v_when, now()))
  returning id into v_id;
  if v_when <= now() + interval '1 minute' then v_n := private.deliver_message(v_id); end if;
  return jsonb_build_object('id', v_id, 'recipients', v_n);
end $$;

create or replace function public.cancel_message(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.messages set status = 'cancelled'
  where id = p_id and club_id = private.my_club() and status = 'scheduled'
    and (author_id = app_auth.uid() or private.my_role() in ('admin', 'secretary', 'sporting_director'));
  if not found then raise exception 'Mesajul nu mai poate fi anulat.' using errcode = '22023'; end if;
end $$;

create or replace function public.mark_message_read(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.message_recipients set read_at = coalesce(read_at, now()) where message_id = p_id and user_id = app_auth.uid();
  update public.notifications set read_at = coalesce(read_at, now()) where user_id = app_auth.uid() and dedupe_key = 'msg:' || p_id;
$$;

/** Sarcina programată: mesajele ajunse la ora lor. */
create or replace function public.run_scheduled_messages() returns int
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_n int := 0;
begin
  if app_auth.role() <> 'service_role' then raise exception 'Doar sarcina programată.' using errcode = '42501'; end if;
  for v_id in select id from public.messages where status = 'scheduled' and scheduled_at <= now() order by scheduled_at limit 200 loop
    perform private.deliver_message(v_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

revoke all on function public.run_scheduled_messages() from public, anon, authenticated;
grant execute on function public.run_scheduled_messages() to service_role;
grant execute on function public.preview_message_audience(jsonb), public.send_message(jsonb), public.cancel_message(uuid),
  public.mark_message_read(uuid) to authenticated;
