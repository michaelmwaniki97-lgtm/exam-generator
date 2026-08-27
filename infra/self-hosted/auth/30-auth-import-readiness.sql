\set ON_ERROR_STOP on

-- Phase-6 import/readiness guardrails only. This migration does not repoint
-- application FKs and does not remove auth.users or Supabase Auth.
-- The actual privileged auth export is supplied offline and must never be
-- committed to the repository.

create unique index if not exists better_auth_users_lower_email_key
  on better_auth.users (lower(email));

comment on index better_auth.better_auth_users_lower_email_key is
  'Normalized-email uniqueness required before Supabase Auth UUID import/cutover.';
