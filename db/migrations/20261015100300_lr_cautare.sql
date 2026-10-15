-- =============================================================================
-- Locker Room · 4 · Căutarea globală (⌘K) și jurnalul de audit pentru administrator
-- =============================================================================

-- Caută în ce poate vedea utilizatorul (SECURITY INVOKER: RLS se aplică normal).
-- Fără diacritice: „stefan" găsește „Ștefan".
create or replace function public.search_club(p_query text, p_limit int default 6) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with q as (select '%' || lower(public.unaccent_ro(trim(p_query))) || '%' as pat)
  select jsonb_build_object(
    'players', coalesce((
      select jsonb_agg(x) from (
        select pl.id, pl.display_name, pl.full_name, pl.shirt_number, g.name as team
        from public.players pl left join public.groups g on g.id = pl.group_id, q
        where pl.is_active and pl.anonymized_at is null
          and (lower(public.unaccent_ro(pl.full_name)) like q.pat or lower(public.unaccent_ro(pl.display_name)) like q.pat)
        order by pl.display_name limit p_limit) x), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(x) from (
        select g.id, g.name from public.groups g, q
        where g.is_active and lower(public.unaccent_ro(g.name)) like q.pat
        order by g.sort, g.name limit p_limit) x), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(x) from (
        select e.id, e.kind, e.title, e.starts_at from public.events e, q
        where e.deleted_at is null and e.starts_at >= now() - interval '14 days'
          and lower(public.unaccent_ro(e.title)) like q.pat
        order by e.starts_at limit p_limit) x), '[]'::jsonb),
    'guardians', coalesce((
      select jsonb_agg(x) from (
        select gu.id, gu.full_name, gu.phone from public.guardians gu, q
        where gu.deleted_at is null and lower(public.unaccent_ro(gu.full_name)) like q.pat
        order by gu.full_name limit p_limit) x), '[]'::jsonb)
  )
  where length(trim(coalesce(p_query, ''))) >= 2
$$;

revoke execute on function public.search_club(text, int) from public, anon;
grant execute on function public.search_club(text, int) to authenticated, service_role;

create policy audit_log_select_admin on public.audit_log for select to authenticated
  using (club_id = (select private.my_club()) and (select private.my_role()) = 'admin');
