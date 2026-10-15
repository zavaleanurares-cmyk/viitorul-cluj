-- Locker Room · faza 3 · Bani: corecturi după primele teste.
set local check_function_bodies = off;

-- sum(bigint) întoarce numeric: formatăm și sumele numerice
drop function if exists private.lei(bigint);
create or replace function private.lei(p numeric) returns text
language sql immutable set search_path = '' as $$
  select replace(replace(replace(to_char(p / 100.0, 'FM999G999G990D00'), ',', '#'), '.', ','), '#', '.') || ' lei'
$$;
revoke execute on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;
