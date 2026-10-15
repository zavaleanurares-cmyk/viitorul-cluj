-- Locker Room faza 4 · Încărcare: după fiecare antrenament și meci, jucătorii cu cont primesc cererea de RPE
-- („Cât de greu a fost?"), dacă n-au completat-o deja. Rulează din sarcina programată.

create or replace function public.run_rpe_requests() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; v_n int := 0;
begin
  if app_auth.role() <> 'service_role' then raise exception 'Doar sarcina programată.' using errcode = '42501'; end if;
  for r in
    with ev as (
      select e.id, e.kind, e.title, e.club_id,
             (e.starts_at at time zone coalesce(c.settings->>'timezone', 'Europe/Bucharest'))::date as day
      from public.events e join public.clubs c on c.id = e.club_id
      where e.kind in ('training', 'match') and e.status <> 'cancelled' and e.deleted_at is null
        and e.ends_at between now() - interval '12 hours' and now()
    ),
    who as (
      -- antrenament: jucătorii echipelor, fără cei marcați absenți / accidentați
      select ev.*, pl.id as player_id, pl.user_id
      from ev join public.event_teams et on et.event_id = ev.id
      join public.players pl on pl.group_id = et.group_id
      where ev.kind = 'training'
        and not exists (select 1 from public.attendance a where a.event_id = ev.id and a.player_id = pl.id and a.status not in ('present', 'late'))
      union
      -- meci: doar cei din lot care au jucat (sau lotul, dacă minutele nu sunt încă trecute)
      select ev.*, pl.id, pl.user_id
      from ev join public.match_squad ms on ms.event_id = ev.id
      join public.players pl on pl.id = ms.player_id
      where ev.kind = 'match' and coalesce(ms.minutes, 1) > 0
    )
    select distinct w.id as event_id, w.kind, w.day, w.player_id, w.user_id
    from who w join public.players pl on pl.id = w.player_id
    where w.user_id is not null and pl.is_active and pl.anonymized_at is null
      and not exists (select 1 from public.rpe_entries x where x.player_id = w.player_id and x.entry_date = w.day
                        and x.session_type = case w.kind when 'match' then 'match' else 'training' end)
  loop
    insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
    values (r.user_id, 'rpe_request',
            case r.kind when 'match' then 'Cât de greu a fost meciul?' else 'Cât de greu a fost antrenamentul?' end,
            'Notează efortul (1–10) și durata. Durează 10 secunde.', '/azi', 'rpe:' || r.event_id || ':' || r.player_id)
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    if found then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end $$;
revoke all on function public.run_rpe_requests() from public, anon, authenticated;
grant execute on function public.run_rpe_requests() to service_role;
