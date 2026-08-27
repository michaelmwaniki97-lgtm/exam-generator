\set ON_ERROR_STOP on

-- MANUAL AUTH CUTOVER ONLY. Do not run from normal database bootstrap.
-- Preconditions:
--   1. public application data has been restored to the self-hosted target;
--   2. the privileged Supabase Auth export has been imported into better_auth.*;
--   3. readiness counts are all zero;
--   4. signup/password mutations are frozen for the final delta window.
--
-- This transaction moves the three application identity foreign keys from the
-- temporary auth.users compatibility table to Better Auth's canonical UUIDs.
-- auth.uid()/authenticated RLS compatibility remains unchanged because those
-- helpers consume the server-validated UUID through transaction-local claims.

begin;

lock table auth.users,
           better_auth.users,
           public.teachers,
           public.admins,
           public.textbook_documents
  in share row exclusive mode;

do $auth_cutover_schema$
declare
  v_expected integer;
begin
  select count(*) into v_expected
    from pg_constraint c
    join pg_class source on source.oid = c.conrelid
    join pg_namespace source_ns on source_ns.oid = source.relnamespace
    join pg_class target on target.oid = c.confrelid
    join pg_namespace target_ns on target_ns.oid = target.relnamespace
   where c.contype = 'f'
     and source_ns.nspname = 'public'
     and target_ns.nspname = 'auth'
     and target.relname = 'users'
     and (
       (source.relname = 'teachers' and c.conname = 'teachers_user_id_fkey' and c.confdeltype = 'c')
       or (source.relname = 'admins' and c.conname = 'admins_user_id_fkey' and c.confdeltype = 'c')
       or (source.relname = 'textbook_documents' and c.conname = 'textbook_documents_uploaded_by_fkey' and c.confdeltype = 'r')
     );

  if v_expected <> 3 then
    raise exception 'Better Auth identity cutover expected exactly three historical auth.users foreign keys with reviewed delete actions; found %', v_expected;
  end if;
end
$auth_cutover_schema$;

do $auth_cutover_readiness$
declare
  v_auth_missing integer;
  v_better_missing integer;
  v_email_mismatch integer;
  v_teacher_missing integer;
  v_admin_missing integer;
  v_document_missing integer;
begin
  select count(*) into v_auth_missing
    from auth.users a
    left join better_auth.users b on b.id = a.id
   where b.id is null;

  select count(*) into v_better_missing
    from better_auth.users b
    left join auth.users a on a.id = b.id
   where a.id is null;

  select count(*) into v_email_mismatch
    from auth.users a
    join better_auth.users b on b.id = a.id
   where lower(coalesce(a.email, '')) <> lower(b.email);

  select count(*) into v_teacher_missing
    from public.teachers t
    left join better_auth.users b on b.id = t.user_id
   where b.id is null;

  select count(*) into v_admin_missing
    from public.admins a
    left join better_auth.users b on b.id = a.user_id
   where b.id is null;

  select count(*) into v_document_missing
    from public.textbook_documents d
    left join better_auth.users b on b.id = d.uploaded_by
   where b.id is null;

  if v_auth_missing <> 0
     or v_better_missing <> 0
     or v_email_mismatch <> 0
     or v_teacher_missing <> 0
     or v_admin_missing <> 0
     or v_document_missing <> 0 then
    raise exception
      'Better Auth identity cutover readiness failed: auth_missing=%, better_missing=%, email_mismatch=%, teacher_missing=%, admin_missing=%, document_missing=%',
      v_auth_missing, v_better_missing, v_email_mismatch,
      v_teacher_missing, v_admin_missing, v_document_missing;
  end if;
end
$auth_cutover_readiness$;

alter table public.teachers
  drop constraint teachers_user_id_fkey;
alter table public.teachers
  add constraint teachers_user_id_fkey
  foreign key (user_id) references better_auth.users(id)
  on delete cascade not valid;

alter table public.admins
  drop constraint admins_user_id_fkey;
alter table public.admins
  add constraint admins_user_id_fkey
  foreign key (user_id) references better_auth.users(id)
  on delete cascade not valid;

alter table public.textbook_documents
  drop constraint textbook_documents_uploaded_by_fkey;
alter table public.textbook_documents
  add constraint textbook_documents_uploaded_by_fkey
  foreign key (uploaded_by) references better_auth.users(id)
  on delete restrict not valid;

alter table public.teachers validate constraint teachers_user_id_fkey;
alter table public.admins validate constraint admins_user_id_fkey;
alter table public.textbook_documents validate constraint textbook_documents_uploaded_by_fkey;

-- Better Auth signup provisions the teacher row directly after this point.
-- Keep the legacy function for rollback inspection, but prevent accidental new
-- local auth.users inserts from trying to create profiles after the FK switch.
drop trigger if exists on_auth_user_created on auth.users;

-- Phase 3 granted these rights only for the temporary Better Auth -> auth.users
-- signup bridge. They are no longer required after the FK cutover.
revoke select, insert on table auth.users from service_role;

-- auth.uid()/auth.role() remain compatibility helpers for the existing RLS
-- policies. Keep only schema/function access for the API roles; this does not
-- restore any auth.users table privilege.
grant usage on schema auth to anon, authenticated, service_role;
revoke all on function auth.uid() from public;
revoke all on function auth.role() from public;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

comment on table auth.users is
  'Legacy Auth migration snapshot/rollback aid. Application identity FKs now reference better_auth.users.';
comment on constraint teachers_user_id_fkey on public.teachers is
  'Canonical application identity UUID from better_auth.users after Auth cutover.';
comment on constraint admins_user_id_fkey on public.admins is
  'Canonical application identity UUID from better_auth.users after Auth cutover.';
comment on constraint textbook_documents_uploaded_by_fkey on public.textbook_documents is
  'Canonical uploader UUID from better_auth.users after Auth cutover.';

commit;
