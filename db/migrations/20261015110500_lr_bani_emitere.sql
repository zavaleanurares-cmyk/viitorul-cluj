-- Locker Room · faza 3 · Bani: emiterea automată, o dată pe lună.
-- Sarcina programată rulează de două ori pe zi; taxele lunii se emit o singură dată, în ziua setată
-- (sau la prima rulare de după ea). Jucătorii înscriși mai târziu în lună îi taxează biroul, din ecranul Taxe.
alter table public.finance_settings add column last_auto_issue date;

create or replace function public.auto_issue_due() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v record; v_today date; v_period date; v_res jsonb; v_out jsonb := '[]'::jsonb;
begin
  for v in select fs.club_id, fs.issue_day, fs.last_auto_issue from public.finance_settings fs where fs.auto_issue loop
    v_today := private.club_today(v.club_id);
    v_period := date_trunc('month', v_today)::date;
    if extract(day from v_today) < v.issue_day then continue; end if;
    if v.last_auto_issue is not null and v.last_auto_issue >= v_period then continue; end if;
    v_res := public.issue_monthly_charges(v_period, v.club_id);
    update public.finance_settings set last_auto_issue = v_period where club_id = v.club_id;
    v_out := v_out || jsonb_build_object('club_id', v.club_id, 'period', v_period) || v_res;
  end loop;
  return v_out;
end $$;

revoke execute on function public.auto_issue_due() from public, anon, authenticated;
grant execute on function public.auto_issue_due() to service_role;
