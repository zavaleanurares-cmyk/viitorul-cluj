-- Locker Room · faza 3 · Bani: funcții pentru ecranele biroului.
set local check_function_bodies = off;

-- „Trimite reamintire": anunță acum familiile cu taxe trecute de scadență (o dată pe zi și familie).
create or replace function public.remind_overdue_families() returns int
language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); v_today date; v_g record; v_n int := 0;
begin
  if not private.is_finance() then raise exception 'Doar biroul trimite reamintiri.' using errcode = '42501'; end if;
  v_today := private.club_today(v_club);
  for v_g in
    select cb.guardian_id, sum(cb.balance) as due, count(*) as n
    from public.charge_balances cb
    where cb.club_id = v_club and cb.guardian_id is not null and cb.balance > 0 and cb.status = 'open' and cb.due_on < v_today
    group by cb.guardian_id
  loop
    perform private.notify_guardian(v_g.guardian_id, 'fee_reminder', 'Ai de plătit ' || private.lei(v_g.due),
      case when v_g.n = 1 then 'O taxă a trecut de scadență.' else v_g.n || ' taxe au trecut de scadență.' end,
      '/plati', 'fee-reminder:' || v_today::text);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Lotul cu taxa fiecăruia pentru o lună: planul în vigoare (al jucătorului sau al echipei), reducerile active,
-- taxa emisă (dacă există) și plătitorul. Baza pentru „Situație", „Planuri" și jucătorii fără taxă.
create or replace function public.fee_roster(p_period date)
returns table (player_id uuid, full_name text, group_id uuid, is_active boolean, fee bigint, own_plan boolean,
               adjustments text, guardian_id uuid, guardian_name text, payment_ref text,
               charge_id uuid, net bigint, paid bigint, state text, due_on date)
language plpgsql stable security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); v_period date := date_trunc('month', p_period)::date;
begin
  if not private.is_finance() then raise exception 'Doar biroul vede taxele.' using errcode = '42501'; end if;
  return query
  select pl.id, pl.full_name, pl.group_id, pl.is_active,
         private.effective_fee(pl.id, v_period),
         exists (select 1 from public.fee_plans fp where fp.player_id = pl.id and fp.deleted_at is null
                 and fp.valid_from <= v_period and (fp.valid_to is null or fp.valid_to >= v_period)),
         (select string_agg(case a.kind when 'percent' then a.value || '%' when 'waiver' then 'scutit'
                   else replace(to_char(a.value / 100.0, 'FM999990D00'), '.', ',') || ' lei' end
                   || ' · ' || case a.reason when 'sibling' then 'frați' when 'scholarship' then 'bursă' when 'injury' then 'accidentare'
                   when 'pause' then 'pauză' when 'staff_child' then 'copil de angajat' else coalesce(a.note, 'alt motiv') end, '; ' order by a.created_at)
          from public.fee_adjustments a where a.player_id = pl.id and a.deleted_at is null
            and a.from_month <= v_period and (a.to_month is null or a.to_month >= v_period)),
         g.id, g.full_name, g.payment_ref,
         cb.id, cb.net, cb.paid, cb.state, cb.due_on
  from public.players pl
  left join public.guardians g on g.id = private.billing_guardian(pl.id)
  left join public.charge_balances cb on cb.player_id = pl.id and cb.kind = 'monthly' and cb.period = v_period and cb.status = 'open'
  where pl.club_id = v_club and pl.anonymized_at is null
    and (pl.is_active or cb.id is not null)
  order by pl.full_name;
end $$;

revoke execute on function public.remind_overdue_families(), public.fee_roster(date) from public, anon;
grant execute on function public.remind_overdue_families(), public.fee_roster(date) to authenticated, service_role;
