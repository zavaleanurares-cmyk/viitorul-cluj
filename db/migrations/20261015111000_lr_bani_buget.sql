-- Locker Room · faza 3 · Bani: raportul de buget compara luna cu ea însăși (alias ambiguu); acum pe luni.
set local check_function_bodies = off;
create or replace function public.budget_report(p_year int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); v_out jsonb;
begin
  if not private.can_see_money_summary() then raise exception 'Nu ai acces la buget.' using errcode = '42501'; end if;
  with recursive tree as (
    select d.id, d.id as root from public.departments d where d.club_id = v_club and d.parent_id is null and d.deleted_at is null
    union all
    select d.id, t.root from public.departments d join tree t on d.parent_id = t.id where d.deleted_at is null
  ),
  roots as (select d.id, d.name, d.sort from public.departments d where d.club_id = v_club and d.parent_id is null and d.deleted_at is null),
  actual as (
    select coalesce(t.root, '00000000-0000-0000-0000-000000000000'::uuid) as root, extract(month from e.spent_on)::int as m, sum(e.amount) as amount
    from public.expenses e left join tree t on t.id = e.department_id
    where e.club_id = v_club and e.deleted_at is null and extract(year from e.spent_on) = p_year
    group by 1, 2
  ),
  planned as (
    select coalesce(t.root, '00000000-0000-0000-0000-000000000000'::uuid) as root, b.month as m, sum(b.amount) as amount
    from public.budget_lines b left join tree t on t.id = b.department_id
    where b.club_id = v_club and b.year = p_year and b.kind = 'expense'
    group by 1, 2
  )
  select jsonb_build_object('departments', coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'name', r.name,
      'planned', (select coalesce(jsonb_agg(coalesce((select pl.amount from planned pl where pl.root = r.id and pl.m = gs.mo), 0) order by gs.mo), '[]') from generate_series(1, 12) as gs(mo)),
      'actual', (select coalesce(jsonb_agg(coalesce((select a.amount from actual a where a.root = r.id and a.m = gs.mo), 0) order by gs.mo), '[]') from generate_series(1, 12) as gs(mo))
    ) order by r.sort, r.name), '[]'::jsonb),
    'unassigned', (select coalesce(jsonb_agg(coalesce((select a.amount from actual a where a.root = '00000000-0000-0000-0000-000000000000'::uuid and a.m = gs.mo), 0) order by gs.mo), '[]') from generate_series(1, 12) as gs(mo)))
  into v_out from roots r;
  return v_out;
end $$;
