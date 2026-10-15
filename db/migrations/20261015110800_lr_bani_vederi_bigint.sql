-- Locker Room · faza 3 · Bani: sumele din vederi rămân bigint (sum(bigint) ar întoarce numeric).
drop view public.charge_balances;
drop view public.payment_balances;

create view public.charge_balances with (security_invoker = true) as
  select c.id, c.club_id, c.player_id, c.guardian_id, c.kind, c.request_id, c.period, c.title,
         c.amount, c.discount, c.discount_note, c.amount - c.discount as net, c.due_on, c.status, c.issued_at,
         coalesce(a.paid, 0)::bigint as paid,
         (case when c.status = 'cancelled' then 0 else c.amount - c.discount - coalesce(a.paid, 0) end)::bigint as balance,
         case
           when c.status = 'cancelled' then 'cancelled'
           when c.amount - c.discount = 0 then 'waived'
           when coalesce(a.paid, 0) >= c.amount - c.discount then 'paid'
           when coalesce(a.paid, 0) > 0 then 'partial'
           else 'open'
         end as state,
         a.last_paid_on
  from public.charges c
  left join (
    select al.charge_id, sum(al.amount) as paid, max(p.received_on) as last_paid_on
    from public.allocations al left join public.payments p on p.id = al.payment_id
    group by al.charge_id
  ) a on a.charge_id = c.id;

create view public.payment_balances with (security_invoker = true) as
  select p.id, p.club_id, p.guardian_id, p.player_id, p.amount, p.method, p.provider, p.provider_ref, p.received_on,
         p.payer_name, p.reference, p.note, p.status, p.refunded_amount, p.created_at,
         coalesce(a.allocated, 0)::bigint as allocated,
         (case when p.status = 'void' then 0 else p.amount - p.refunded_amount - coalesce(a.allocated, 0) end)::bigint as unallocated
  from public.payments p
  left join (select al.payment_id, sum(al.amount) as allocated from public.allocations al group by al.payment_id) a
    on a.payment_id = p.id;

grant select on public.charge_balances, public.payment_balances to authenticated, service_role;
