-- Notele jucătorilor la antrenament (1–5), ca notele de meci: separat de prezență și vizibile doar staff-ului
-- care conduce antrenamentul sau îl supraveghează. Jucătorii și părinții nu le văd.

create table public.training_ratings (
  event_id   uuid not null references public.events(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  rated_by   uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, player_id)
);
create index training_ratings_player_idx on public.training_ratings (player_id);

alter table public.training_ratings enable row level security;
grant select on public.training_ratings to authenticated;
grant all on public.training_ratings to service_role;
create policy training_ratings_select on public.training_ratings for select to authenticated
  using (private.event_club(event_id) = (select private.my_club())
     and ((select private.my_role()) in ('admin', 'sporting_director', 'physio') or private.can_run_event(event_id)));
create trigger training_ratings_audit after insert or update or delete on public.training_ratings
  for each row execute function private.audit();

/**
 * Salvează notele unui antrenament: p_ratings = { "<player_id>": 1..5 | null }. null șterge nota.
 * Doar jucătorii echipelor antrenamentului; doar cine conduce antrenamentul.
 */
create or replace function public.save_training_ratings(p_event uuid, p_ratings jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare v_groups uuid[]; v_n int;
begin
  if not private.can_run_event(p_event) then
    raise exception 'Doar cine conduce antrenamentul dă note.' using errcode = '42501';
  end if;
  if (select kind from public.events where id = p_event) <> 'training' then
    raise exception 'Notele de aici sunt pentru antrenamente.';
  end if;
  v_groups := private.event_group_ids(p_event);

  delete from public.training_ratings tr
  where tr.event_id = p_event and p_ratings ? tr.player_id::text and jsonb_typeof(p_ratings->(tr.player_id::text)) = 'null';

  insert into public.training_ratings (event_id, player_id, rating, rated_by)
  select p_event, k::uuid, (p_ratings->>k)::smallint, app_auth.uid()
  from jsonb_object_keys(coalesce(p_ratings, '{}'::jsonb)) k
  join public.players pl on pl.id = private.try_uuid(k)
  where jsonb_typeof(p_ratings->k) = 'number' and (p_ratings->>k)::int between 1 and 5
    and pl.club_id = private.my_club() and pl.group_id = any (v_groups)
  on conflict (event_id, player_id) do update set rating = excluded.rating, rated_by = excluded.rated_by, created_at = now();
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.save_training_ratings(uuid, jsonb) from public, anon;
grant execute on function public.save_training_ratings(uuid, jsonb) to authenticated;
