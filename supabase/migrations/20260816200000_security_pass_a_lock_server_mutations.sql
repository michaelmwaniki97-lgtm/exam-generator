-- Security Pass A: canonical exam and marking-scheme writes are server-only.
-- This migration is additive/restrictive: it preserves every existing row and
-- leaves teacher/admin read policies unchanged.

-- A browser-authenticated teacher must not bypass the canonical Server Action
-- by inserting arbitrary exam JSON, status, ownership or blueprint metadata.
drop policy if exists exams_insert_own on public.exams;
drop policy if exists exams_update_own_unpaid on public.exams;
revoke insert, update, delete on public.exams from authenticated;

-- Marking schemes are created together with the canonical exam on the server.
drop policy if exists marking_schemes_insert_own on public.marking_schemes;
drop policy if exists marking_schemes_update_own_unpaid on public.marking_schemes;
revoke insert, update, delete on public.marking_schemes from authenticated;

-- The dedicated server-only service-role client performs the validated writes.
grant insert, update, delete on public.exams to service_role;
grant insert, update, delete on public.marking_schemes to service_role;

-- RLS protects which teacher row can be updated; column privileges additionally
-- prevent a direct REST request from changing identity or audit columns.
revoke insert, update, delete on public.teachers from authenticated;
grant update (name, school, phone) on public.teachers to authenticated;
