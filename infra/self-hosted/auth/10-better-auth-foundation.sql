\set ON_ERROR_STOP on

-- Better Auth foundation for the self-hosted target only.
-- This intentionally does NOT replace the temporary Supabase-compatible
-- auth.users schema or repoint any application foreign keys yet.

create schema if not exists better_auth;
revoke all on schema better_auth from public;

create table if not exists better_auth.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  email_verified boolean not null default false,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists better_auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references better_auth.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists better_auth_sessions_user_id_idx
  on better_auth.sessions(user_id);
create index if not exists better_auth_sessions_expires_at_idx
  on better_auth.sessions(expires_at);

create table if not exists better_auth.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references better_auth.users(id) on delete cascade,
  issuer text not null,
  account_id text not null,
  provider_id text not null,
  access_token text,
  refresh_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  id_token text,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint better_auth_accounts_issuer_account_id_key unique (issuer, account_id)
);

create index if not exists better_auth_accounts_user_id_idx
  on better_auth.accounts(user_id);
create index if not exists better_auth_accounts_provider_id_idx
  on better_auth.accounts(provider_id);

create table if not exists better_auth.verifications (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists better_auth_verifications_identifier_idx
  on better_auth.verifications(identifier);
create index if not exists better_auth_verifications_expires_at_idx
  on better_auth.verifications(expires_at);

revoke all on all tables in schema better_auth from public;

-- The disposable parity harness defines this future runtime role. Production
-- Supabase does not, so keep the grant conditional and self-hosted-safe.
do $grant_runtime$
begin
  if exists (select 1 from pg_roles where rolname = 'exam_app_runtime') then
    grant usage on schema better_auth to exam_app_runtime;
    grant select, insert, update, delete on all tables in schema better_auth to exam_app_runtime;
  end if;
end
$grant_runtime$;

comment on schema better_auth is
  'Self-hosted Better Auth foundation. Application identity FKs remain on auth.users until explicit Auth cutover.';
