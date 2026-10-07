-- =============================================================================
-- 0000 · Platformă: roluri Postgres, identitatea cererii, autentificare
--
-- Aplicația se conectează cu un singur utilizator de bază de date (proprietarul tabelelor),
-- dar fiecare cerere a unui utilizator rulează într-o tranzacție în care:
--     set local role authenticated;
--     set local request.jwt.claims = '{"sub": "<id utilizator>", "role": "authenticated"}';
-- Astfel GRANT-urile și Row Level Security se aplică fiecărei interogări, iar `app_auth.uid()`
-- spune politicilor cine întreabă. Este același model pe care îl folosește PostgREST.
-- =============================================================================

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin noinherit', r);
    end if;
    -- conexiunea aplicației trebuie să poată trece în aceste roluri
    begin
      execute format('grant %I to %I', r, current_user);
    exception when others then
      raise notice 'grant % către %: %', r, current_user, sqlerrm;
    end;
  end loop;
end $$;

grant usage on schema public to anon, authenticated, service_role;

create schema if not exists app_auth;
revoke all on schema app_auth from public;
grant usage on schema app_auth to anon, authenticated, service_role;

create or replace function app_auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create or replace function app_auth.uid() returns uuid
language sql stable as $$
  select nullif(app_auth.jwt() ->> 'sub', '')::uuid
$$;

create or replace function app_auth.role() returns text
language sql stable as $$
  select coalesce(app_auth.jwt() ->> 'role', 'anon')
$$;

grant execute on function app_auth.jwt(), app_auth.uid(), app_auth.role() to anon, authenticated, service_role;

-- Utilizatori. Rolurile aplicației nu au niciun drept pe tabelele din `app_auth`.
create table if not exists app_auth.users (
  id               uuid primary key default gen_random_uuid(),
  email            text not null,
  password_hash    text,                       -- scrypt; null până la activarea contului
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  last_sign_in_at  timestamptz,
  disabled_at      timestamptz
);
create unique index if not exists users_email_uq on app_auth.users (lower(email));

create table if not exists app_auth.sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references app_auth.users(id) on delete cascade,
  token_hash    text not null unique,           -- SHA-256 al tokenului din cookie
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  expires_at    timestamptz not null,
  user_agent    text,
  ip            text,
  -- sesiune deschisă printr-un link de invitație / resetare: permite setarea parolei fără cea veche
  via_link      boolean not null default false
);
create index if not exists sessions_user_idx on app_auth.sessions (user_id);

-- Linkuri de unică folosință: invitație (activarea contului) și resetare de parolă.
create table if not exists app_auth.tokens (
  token_hash  text primary key,
  user_id     uuid not null references app_auth.users(id) on delete cascade,
  kind        text not null check (kind in ('invite', 'recovery')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);
create index if not exists tokens_user_idx on app_auth.tokens (user_id);

create table if not exists app_auth.login_attempts (
  id          bigint generated always as identity primary key,
  email       text,
  ip          text,
  succeeded   boolean not null,
  created_at  timestamptz not null default now()
);
create index if not exists login_attempts_email_idx on app_auth.login_attempts (email, created_at);
create index if not exists login_attempts_ip_idx on app_auth.login_attempts (ip, created_at);

revoke all on all tables in schema app_auth from public, anon, authenticated, service_role;
