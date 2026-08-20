# Security Pass A — Core Application

Audit date: 2026-08-16  
Scope: checklist items 1, 3, 4, 6, 7, 8, 9, 10, 14, 15, 16, and 18 only.

## Audit boundary and live-state limitation

This pass inspected the Next.js application, Server Actions, Supabase clients, runtime database calls, authentication/session helpers, rendering paths, and every SQL migration in the repository. It did not query or mutate the live Supabase database.

**⏳ NOT AUDITED LIVE — Verified from repository migrations/policies only; live production state still requires confirmation.**

The restrictive migration created by this pass must be deployed through the project's reviewed Supabase migration workflow before the browser-write hardening is active in a deployed database.

## Checklist findings

### 1 — Server-only API keys / secrets

- **Requirement:** Private provider credentials and privileged database credentials must remain out of browser bundles, props, responses, storage, and logs.
- **Status:** ✅ VERIFIED
- **Evidence:** Browser Supabase setup references only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. AI configuration is protected by `server-only`. The service-role key is referenced only by server-only application code and maintenance scripts. `.env*` is ignored. No application use of `localStorage` or `sessionStorage` was found.
- **Files inspected:** `.gitignore`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `lib/supabase/admin.ts`, `lib/ai/config.ts`, `lib/ai/client.ts`, `lib/ai/generate-exam.ts`, `scripts/*.mjs`, `app/**/*`, `components/**/*`.
- **Changes made:** Added `server-only` guards to the server Supabase clients; added a client-boundary regression test. No credential values were printed or copied.
- **Remaining risk:** Git-history secret scanning is deferred to Pass C.
- **Manual verification needed:** Inspect a production browser bundle and Network panel for private-key names or values without sharing the values.

### 3 — Frontend uses only public/anon database credentials

- **Requirement:** Client Components may use only the project URL and public anon/publishable key; privileged access must be isolated server-side.
- **Status:** ✅ VERIFIED
- **Evidence:** `lib/supabase/client.ts` uses only the public URL and anon key. `lib/supabase/admin.ts` imports `server-only`, uses a separate non-persistent Supabase client, and is imported by a Server Action only.
- **Files inspected:** `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, every Client Component under `app/` and `components/`.
- **Changes made:** Introduced the dedicated server-only privileged client and protected the cookie-backed server client with `server-only`.
- **Remaining risk:** A production bundle still needs manual confirmation after deployment.
- **Manual verification needed:** Search loaded JavaScript and responses for service-role/private provider credentials.

### 4 — Row Level Security on every application table

- **Requirement:** Every application table must enable RLS and have an intentional command-by-command role/ownership model.
- **Status:** 🟡 PARTIAL
- **Evidence:** All 16 repository application tables enable RLS in migrations. Policies enforce own-teacher, admin-only, authenticated-read, or service-only behavior as detailed in the matrix below. The new migration removes direct authenticated exam/marking writes and limits teacher profile updates to approved columns.
- **Files/policies inspected:** `20260811150000_init_schema.sql`, `20260816170000_prepare_verified_curriculum_import.sql`, `20260816200000_security_pass_a_lock_server_mutations.sql`; all policies listed in the matrix.
- **Changes made:** Added an additive/restrictive migration. It preserves rows and read policies and does not drop tables or columns.
- **Remaining risk:** Live RLS enablement, policies, grants, ownership, and migration application were not queried. The new restriction is not active until deployed.
- **Manual verification needed:** Apply the reviewed migration, inspect live `pg_policies` and grants, and test anon/teacher/admin/service behavior with non-production fixtures or controlled accounts.

### 6 — Authentication enforced server-side

- **Requirement:** Sensitive routes and mutations must establish the authenticated identity on the server and never trust client owner/role fields.
- **Status:** ✅ VERIFIED
- **Evidence:** Teacher/admin layouts and middleware refresh/check the Supabase user; sensitive Server Actions call provider-backed `auth.getUser()` or centralized session helpers. Exam creation derives the teacher row from the authenticated user. No client-supplied teacher ID or admin flag is used for authorization.
- **Files inspected:** `proxy.ts`, `lib/auth/session.ts`, `lib/auth/access.ts`, `app/teacher/layout.tsx`, `app/admin/layout.tsx`, `app/actions/auth.ts`, `app/actions/admin.ts`, `app/actions/exams.ts`.
- **Changes made:** None required for the core auth gate.
- **Remaining risk:** Browser acceptance is still needed against the configured Supabase project.
- **Manual verification needed:** Logged-out teacher route, teacher-to-admin route, and direct admin-action attempts.

### 7 — Per-user record ownership

- **Requirement:** Teachers must not read or mutate another teacher's profile, exam, marking scheme, or payment.
- **Status:** 🟡 PARTIAL
- **Evidence:** Repository policies restrict teacher records by `auth.uid()`, exams/payments by `current_teacher_id()`, and marking-scheme reads through the owned parent exam. Inaccessible exam IDs produce the same not-found behavior as missing IDs. Route IDs are UUID-validated before queries.
- **Files/policies inspected:** teacher/exam/marking/payment policies in `20260811150000_init_schema.sql`; exam and marking-scheme pages; profile and exam actions.
- **Changes made:** Added malformed-ID guards and removed authenticated exam/marking write access in the new migration.
- **Remaining risk:** Live policy state has not been confirmed; ownership isolation therefore cannot be marked fully verified for deployment.
- **Manual verification needed:** Teacher A requests Teacher B's exam and marking-scheme URLs; verify no record and no ownership oracle is returned.

### 8 — Mass-assignment protection / allowlists

- **Requirement:** Client payloads must not implicitly control IDs, roles, ownership, timestamps, status, or canonical blueprint metadata.
- **Status:** 🟡 PARTIAL
- **Evidence:** Admin/profile actions clean named fields and write explicit object literals. Exam creation reloads Grade/Form, subject, textbook, curriculum, assessment, structure, and component; derives teacher ownership; constructs persisted content explicitly; and builds the blueprint server-side. No direct payload spread into a database mutation was found.
- **Files inspected:** `app/actions/auth.ts`, `app/actions/admin.ts`, `app/actions/exams.ts`, `lib/admin/validation.ts`, `lib/assessment/validation.ts`, `lib/curriculum/exam-selection.ts`, `lib/blueprint/engine.ts`.
- **Changes made:** Canonical exam and marking-scheme persistence now uses a server-only client. The migration removes the browser's direct authenticated write path and limits teacher updates to `name`, `school`, and `phone`.
- **Remaining risk:** Until the migration is applied live, an authenticated browser could still use the old database grants/policies to write arbitrary content to an owned exam, bypassing the canonical Server Action.
- **Manual verification needed:** After migration, attempt direct REST inserts/updates as an authenticated teacher; they must be denied while normal Server Action creation succeeds.

### 9 — Secure session/cookie handling

- **Requirement:** Use the supported provider-managed SSR cookie flow, avoid custom tokens/cookies, and invalidate logout state.
- **Status:** ✅ VERIFIED
- **Evidence:** The application uses `@supabase/ssr` browser/server clients, middleware cookie refresh, and provider `auth.getUser()` validation. Logout calls `auth.signOut()`. No custom JWT, cookie cryptography, or application token storage was found.
- **Files inspected:** `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `proxy.ts`, `lib/auth/session.ts`, `app/actions/auth.ts`.
- **Changes made:** Added a server-only import boundary to the server client.
- **Remaining risk:** Deployment cookie attributes and HTTPS behavior belong to the deployment/pre-launch pass.
- **Manual verification needed:** Log out, revisit a protected route, and verify redirection/login is required.

### 10 — Password security through the authentication provider

- **Requirement:** Password hashing and credential storage remain with Supabase Auth; application tables/logging must not contain passwords or password hashes.
- **Status:** ✅ VERIFIED
- **Evidence:** Signup/login pass credentials only to Supabase Auth. No password/hash application column, custom hasher, database write, or credential logging was found.
- **Files inspected:** `app/actions/auth.ts`, auth pages, Supabase migrations, runtime logging/search results.
- **Changes made:** Added reasonable credential input length bounds; no password library was added.
- **Remaining risk:** Provider password policy and infrastructure account protections are outside this pass.
- **Manual verification needed:** None beyond ordinary provider signup/login acceptance.

### 14 — Parameterized database queries

- **Requirement:** Runtime database operations must avoid user-built raw SQL.
- **Status:** ✅ VERIFIED
- **Evidence:** Runtime access uses Supabase query-builder methods with bound values. No raw SQL tag, unsafe query executor, concatenated SQL statement, or raw-SQL RPC payload was found in runtime application code.
- **Files inspected:** all TypeScript/TSX under `app/` and `lib/`; runtime Supabase calls and RPC searches.
- **Changes made:** Added a static regression check for common unsafe raw-query APIs.
- **Remaining risk:** Maintenance SQL/migration review remains necessary whenever new runtime RPCs are introduced.
- **Manual verification needed:** None for current runtime paths.

### 15 — Server-side input validation / sanitization

- **Requirement:** Server mutation boundaries must validate shape, length, enums, relationships, numeric bounds, and canonical records.
- **Status:** ✅ VERIFIED
- **Evidence:** Admin CRUD uses shared cleaning/UUID helpers. Profile/signup fields have server-side length bounds. Exam submission validates UUIDs, terms, year, marks, duration, difficulty, duplicate/count limits, assessment/structure/component rules, textbook relationship, and active verified curriculum relationships. Blueprint construction enforces deterministic totals/allowed structures.
- **Files inspected:** `lib/auth/validation.ts`, `lib/admin/validation.ts`, `lib/assessment/validation.ts`, `lib/assessment/rules.ts`, `lib/curriculum/exam-selection.ts`, `lib/blueprint/engine.ts`, associated Server Actions/tests.
- **Changes made:** Added signup/login bounds; exam UUID checks; a 200-curriculum-record maximum; year range 2000–2100; textbook UUID validation; and dynamic-route UUID guards.
- **Remaining risk:** These bounds intentionally do not replace database relationship checks; both layers must remain.
- **Manual verification needed:** Normal registration, profile edit, admin CRUD, and exam creation.

### 16 — Safe rendering / XSS protection

- **Requirement:** User/AI content must not reach raw HTML/DOM sinks unsanitized.
- **Status:** ✅ VERIFIED
- **Evidence:** No `dangerouslySetInnerHTML`, direct `innerHTML`, `document.write`, or raw Markdown/HTML renderer was found under application rendering code. Teacher, school, curriculum, exam, and AI-generated text is rendered through React text interpolation, which escapes text by default.
- **Files inspected:** all TSX/TS files under `app/` and `components/`, especially exam and marking-scheme rendering.
- **Changes made:** Added a raw-HTML-sink regression test; no sanitizer dependency was needed.
- **Remaining risk:** Any future rich-HTML/Markdown feature must receive a separate sanitization review.
- **Manual verification needed:** None for current escaped text rendering.

### 18 — Minimize sensitive data returned by APIs/server actions

- **Requirement:** Queries/actions should return only fields needed by their consumer and never expose provider/auth secrets or unrelated private records.
- **Status:** ✅ VERIFIED
- **Evidence:** Queries use explicit `select(...)` projections. List/dashboard queries omit exam `content`; ownership checks request IDs only; role checks request profile IDs only; actions return status/error messages rather than rows, tokens, or credentials. Detailed exam JSON is loaded only on owned detail/marking pages where required.
- **Files inspected:** teacher/admin pages, `lib/auth/session.ts`, `app/actions/*.ts`, Supabase client setup.
- **Changes made:** No meaningful over-return requiring a refactor was found.
- **Remaining risk:** Admin teacher listings intentionally expose operational profile fields to administrators; future API routes need the same projection discipline.
- **Manual verification needed:** Inspect representative browser responses for absent auth metadata and private credentials.

## RLS matrix

The status in this matrix is partial because it is based on repository SQL, not a query of the deployed database.

| Table | RLS enabled? | SELECT | INSERT | UPDATE | DELETE | Ownership/role model | Status |
|---|---|---|---|---|---|---|---|
| `teachers` | Yes in migration | Own row; admins may read | Auth trigger/service only | Own row, approved `name`, `school`, `phone` columns | No authenticated policy | `auth.uid()` matches `user_id`; admin read via `is_admin()` | 🟡 PARTIAL — live pending |
| `admins` | Yes in migration | Admin only | Admin only | Admin only | Admin only | `is_admin()` for every operation; teachers cannot self-promote | 🟡 PARTIAL — live pending |
| `subjects` | Yes in migration | Authenticated | Admin only | Admin only | Admin only | Curriculum reference data | 🟡 PARTIAL — live pending |
| `grades` | Yes in migration | Authenticated | Admin only | Admin only | Admin only | Curriculum reference data | 🟡 PARTIAL — live pending |
| `strands` | Yes in migration | Authenticated | Admin only | Admin only | Admin only | Active/provisional curriculum roots | 🟡 PARTIAL — live pending |
| `sub_strands` | Yes in migration | Authenticated | Admin only | Admin only | Admin only | Curriculum children | 🟡 PARTIAL — live pending |
| `learning_outcomes` | Yes in migration | Authenticated | Admin only | Admin only | Admin only | Curriculum outcomes | 🟡 PARTIAL — live pending |
| `textbooks` | Yes in migration | Authenticated | Admin only | Admin only | Admin only | Curriculum-aligned reference metadata | 🟡 PARTIAL — live pending |
| `exams` | Yes in migration | Owning teacher; admins may read | Server service role only after new migration | Server service role only after new migration | Server service role only after new migration | Teacher ownership derives from authenticated user's teacher row | 🟡 PARTIAL — live/new migration pending |
| `marking_schemes` | Yes in migration | Teacher through owned parent exam | Server service role only after new migration | Server service role only after new migration | Server service role only after new migration | Ownership derives from `exams.teacher_id` | 🟡 PARTIAL — live/new migration pending |
| `payments` | Yes in migration | Owning teacher; admins may read | No authenticated policy; service workflow only | No authenticated policy; service workflow only | No authenticated policy; service workflow only | Teacher ownership by `teacher_id`; no self-mark-paid path | 🟡 PARTIAL — live pending |
| `app_settings` | Yes in migration | Admin only | Admin only | Admin only | Admin only | Global configuration via `is_admin()` | 🟡 PARTIAL — live pending |
| `strand_objectives` | Yes in migration | Authenticated | Admin only | Admin only | Admin only | Verified curriculum objectives/reference data | 🟡 PARTIAL — live pending |
| `curriculum_imports` | Yes in migration | Admin only | Service role only | Service role only | Service role only | Import audit/control records | 🟡 PARTIAL — live pending |
| `curriculum_import_legacy_records` | Yes in migration | Admin only | Service role only | Service role only | Service role only | Import traceability/quarantine records | 🟡 PARTIAL — live pending |
| `curriculum_source_exceptions` | Yes in migration | Admin only | Service role only | Service role only | Service role only | Source exception records | 🟡 PARTIAL — live pending |

## Blueprint security regression

The canonical Server Action authenticates the user, resolves the teacher, reloads/canonicalizes Grade/Form, subject, assessment, exam structure, official component, textbook, and selected curriculum, then calls `buildExamBlueprint` and persists that generated value. The client does not submit a blueprint field.

The audit found one concrete bypass: the prior authenticated database insert/update policy let a teacher call Supabase REST directly and persist arbitrary JSON in an exam they owned. The new migration revokes those browser writes, and the Server Action now uses the isolated server-only client for the explicit canonical insert. This remediation is complete in the repository but requires migration deployment.

## Database change and safe application

Migration: `supabase/migrations/20260816200000_security_pass_a_lock_server_mutations.sql`

It drops only the two known authenticated exam write policies and two known authenticated marking-scheme write policies, revokes authenticated mutation privileges on those tables, grants server service-role mutation access, and restricts teacher updates to approved profile columns. It does not remove or rewrite rows, tables, columns, read policies, or curriculum data.

Safe deployment procedure:

1. Confirm the Supabase CLI/project link points to the intended environment and take the environment's normal backup/snapshot.
2. Review the exact migration file and run `npx supabase migration list --linked`.
3. If the pending list contains any unexpected migration, stop and review it; do not blindly push.
4. Through the project's established migration pipeline, run `npx supabase db push --linked` only when the reviewed pending list is correct.
5. Reinspect live table RLS/policies/grants, then perform the controlled anon/teacher/admin checks below.

This pass did not execute the migration against a live project.

## Manual acceptance

1. Logged out: visit `/teacher/dashboard`; expect redirect to login and no teacher data.
2. Teacher: visit `/admin`; expect rejection/redirect to teacher home.
3. Teacher: invoke an admin Server Action through safe local test tooling; expect `Administrator access is required` and no mutation.
4. Two controlled teachers: Teacher A requests Teacher B's exam and marking-scheme URLs; expect not found/no private content.
5. DevTools: search loaded client JavaScript and Network response bodies for private/service/provider key names and values; expect none.
6. Teacher: create one normal exam; expect canonical save and redirect to the exam detail.
7. Review: confirm the deterministic blueprint is still displayed before generation and persisted in generated exam metadata.
8. Admin: create/edit/delete a disposable reference row using the normal UI; expect the existing dependency rules and authorization to work.
9. Logout: revisit a protected route; expect a fresh login requirement.
10. Controlled anon Supabase client: query protected user-owned tables; expect no protected rows. Then confirm authenticated direct exam/marking mutation requests are denied after migration.

## Deferred to Security Pass B

- rate limiting
- provider billing caps/alerts
- bot protection
- file upload security
- payment webhook verification
- server-authoritative product pricing
- AI prompt injection handling
- per-user AI limits

## Deferred to Pre-launch Security Pass C

- secret Git-history scan
- encryption review
- HTTPS
- production security headers
- debug/source-map production review
- safe production error handling
- dependency vulnerability review
- logging/monitoring
- backups/restore
- infrastructure 2FA
