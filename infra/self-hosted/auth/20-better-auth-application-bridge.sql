\set ON_ERROR_STOP on

-- TEMPORARY auth-migration bridge only.
-- Better Auth is canonical for credentials/sessions, but the application FKs
-- still reference auth.users until the explicit Auth FK cutover. Signup mirrors
-- the validated Better Auth UUID into auth.users so the existing teacher trigger
-- and all ownership FKs continue to work unchanged.

-- Trusted application transactions SET LOCAL ROLE service_role. Give that role
-- the narrow compatibility-table rights required to provision the mirrored row.
grant usage on schema auth to service_role;
grant select, insert on table auth.users to service_role;
revoke update, delete on table auth.users from service_role;

comment on table auth.users is
  'TEMPORARY auth compatibility identity table. Better Auth signup mirrors the same UUID here until application FKs are repointed.';
