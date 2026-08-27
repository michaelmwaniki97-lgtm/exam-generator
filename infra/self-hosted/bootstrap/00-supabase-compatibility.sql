\set ON_ERROR_STOP on

-- LOCAL PARITY HARNESS ONLY.
-- These objects emulate only the Supabase-owned names required to replay the
-- existing migrations. They are not the future authentication/storage design.

do $compatibility_roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'exam_app_runtime') then
    create role exam_app_runtime login noinherit nosuperuser nocreatedb nocreaterole
      password 'local-parity-runtime-only';
  end if;
end
$compatibility_roles$;

grant authenticated, service_role to exam_app_runtime;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

grant usage on schema public, extensions, auth to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
set search_path = pg_catalog
as $function$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$function$;

create or replace function auth.role()
returns text
language sql
stable
set search_path = pg_catalog
as $function$
  select coalesce(
    nullif(pg_catalog.current_setting('request.jwt.claim.role', true), ''),
    current_user
  )
$function$;

-- Keep the Supabase compatibility helpers callable by the emulated API roles
-- without granting any table privileges in the auth schema.
revoke all on function auth.uid() from public;
revoke all on function auth.role() from public;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

create table storage.buckets (
  id text primary key,
  name text not null unique,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

comment on schema auth is
  'TEMPORARY local parity compatibility schema; not the final auth architecture.';
comment on table auth.users is
  'TEMPORARY minimal Supabase auth.users shape for local migration replay only.';
comment on schema storage is
  'TEMPORARY local parity compatibility schema; no object storage is implemented.';
