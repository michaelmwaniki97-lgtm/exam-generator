# Self-Hosted Infrastructure Migration Audit

Status: audit only; no production behavior, production data, secrets, dependencies, or existing files were changed.

Audit baseline: 2026-08-26, branch `infra-self-hosted`, HEAD `61eb01b562fe83f99752b3497efbfc99e2bdfde3`. Before branch creation, `main` was clean and `0` ahead / `0` behind `origin/main` after a successful fetch. The new branch has no upstream.

## Executive summary

The application is a Next.js 16 App Router application whose browser, React Server Components, server actions, route handlers, maintenance scripts, and SQL security model all depend on Supabase. Supabase currently supplies four separate capabilities: GoTrue identity and session cookies, PostgREST data access, privileged RPC dispatch, and private object storage. Vercel supplies the deployment runtime and one password-recovery URL fallback.

The target should be a Dockerized Next.js Node process behind a TLS reverse proxy, a private PostgreSQL 17 service with `pgcrypto` and `vector`, Better Auth tables in a dedicated schema, and a private filesystem volume accessed only through a storage interface. Daraja remains unchanged behind the existing `PaymentProvider` / `PaymentRepository` boundaries. PDF and AI/exam-generation behavior remain unchanged. shadcn/ui adoption is independent and should begin only after infrastructure parity.

The migration is not a library swap. PostgREST currently enforces RLS using Supabase JWT-derived database roles, while the service-role client bypasses RLS and invokes security-sensitive functions. A direct `pg` connection normally executes under one database role. Every RLS assumption therefore needs either (1) transaction-local identity/role context plus preserved RLS, or (2) an explicit application authorization repository with tests. Security B1 invariants must remain atomic database functions/transactions.

## Audit method and counts

Repository-wide searches covered `@supabase`, `createClient`, `createServerClient`, `createBrowserClient`, `SUPABASE`, `.auth.`, `.from(`, `.rpc(`, `.storage`, `auth.uid`, `service_role`, `NEXT_PUBLIC_SUPABASE`, `VERCEL`, and `PUBLIC_APP_URL`, followed by inspection of callers, migrations, configuration, tests, and scripts.

- 41 Supabase-dependent TypeScript/JavaScript files were identified by direct imports, Supabase helper imports, client method calls, or tests that assert Supabase SQL/security behavior. This count excludes SQL migrations, package manifests, generated lockfile entries, and narrative documentation; they are inventoried separately.
- 13 application `.rpc()` call sites invoke 13 distinct SQL functions.
- 4 Storage operation call sites exist: one upload, one download, and two deletes, all in `app/actions/textbooks.ts`.
- One private Storage bucket exists: `textbooks`.
- Extensions required by repository migrations: `pgcrypto` and `vector` (pgvector). PostgreSQL built-ins used include advisory locks, cryptographic UUID generation, JSONB, enums, partial/unique indexes, triggers, and PL/pgSQL.

## Current architecture

```text
Browser
  -> Next.js 16 proxy.ts (Supabase cookie refresh + protected-prefix redirect)
  -> React Server Components / server actions / route handlers
       -> Supabase SSR client (user JWT, PostgREST + RLS)
       -> Supabase admin client (service-role bypass, RPCs, private Storage)
       -> AI provider (OpenAI/Groq/NVIDIA selection)
       -> Daraja via PaymentProvider abstraction
       -> @react-pdf/renderer and pdfjs-dist

Supabase hosted project
  -> GoTrue auth.users and recovery/email flow
  -> PostgreSQL schema, RLS, triggers, functions, pgcrypto, pgvector
  -> PostgREST RPC/data API
  -> private `textbooks` object bucket

Vercel
  -> Next.js deployment/runtime
  -> VERCEL_PROJECT_PRODUCTION_URL fallback for recovery redirects
```

### Preserved database domain

All UUID primary keys, foreign keys, constraints, indexes, data, and behavior for these tables must be retained: `teachers`, `admins`, `subjects`, `grades`, `strands`, `sub_strands`, `learning_outcomes`, `strand_objectives`, `textbooks`, `textbook_documents`, `textbook_chunks`, `exams`, `marking_schemes`, `payments`, `app_settings`, `curriculum_imports`, `curriculum_import_legacy_records`, `curriculum_source_exceptions`, and `ai_operation_reservations`.

Identity relationships are `teachers.user_id -> auth.users.id` (`ON DELETE CASCADE`), `admins.user_id -> auth.users.id` (`ON DELETE CASCADE`), and `textbook_documents.uploaded_by -> auth.users.id` (`ON DELETE RESTRICT`). `handle_new_user()` currently inserts a teacher profile after an `auth.users` insert.

## Dependency inventory

### A. Authentication

- `app/actions/auth.ts`: sign-up with profile metadata, email/password login, logout, reset-email request, recovery-session password update, and authenticated profile update.
- `app/auth/callback/route.ts`: exchanges the Supabase PKCE code for a session and creates the short-lived `auth-recovery` cookie.
- `lib/auth/session.ts`: cached `getCurrentUser()` and role lookup against `admins` / `teachers`.
- `lib/supabase/server.ts`, `client.ts`, `middleware.ts`: server, browser, and proxy clients.
- `app/actions/exams.ts` and `app/actions/exam-editor.ts`: direct `auth.getUser()` gates.
- `supabase/migrations/20260811150000_init_schema.sql` and `20260811190000_update_handle_new_user_trigger.sql`: auth-user trigger and identity metadata mapping.

Better Auth must cover email/password signup and login, email verification behavior, logout, session validation, reset tokens, password update, CSRF/origin checks, secure cookies, and role/profile resolution. Do not authorize from editable user metadata.

### B. PostgreSQL / data access

PostgREST query-builder use spans these application tables: `admins`, `app_settings`, `exams`, `grades`, `learning_outcomes`, `marking_schemes` (nested relation selects), `payments`, `strands`, `sub_strands`, `subjects`, `teachers`, `textbook_chunks`, `textbook_documents`, and `textbooks`. The maintenance scripts additionally operate on curriculum import tables through their RPC and preflight table counts.

Direct data access is distributed across admin CRUD (`app/actions/admin.ts` and admin pages), exam generation/editing/listing/document load, teacher dashboard/profile/transactions, payments, textbook ingestion/RAG, and the browser exam wizard. The browser wizard directly queries curriculum tables and calls `list_ready_textbooks`; this must move behind authenticated server endpoints/actions before public Supabase credentials can be removed.

Recommended target is a small typed repository/query layer using a single PostgreSQL pool. Use explicit SQL transactions and schema-qualified objects. Select a query approach in Phase 1; the minimal dependency option is `pg`, while a query builder/ORM must not obscure locking, partial indexes, vector operators, or the existing functions.

### C. Supabase RPC / database functions

The 13 application call sites and current signatures are:

| Function | Signature / return | Application caller |
|---|---|---|
| `import_verified_curriculum` | `(p_payload jsonb) -> jsonb` | `scripts/import-verified-curriculum.mjs:318` |
| `list_ready_textbooks` | `(p_subject_id uuid, p_grade_id uuid) -> table(id uuid, name text, publisher text)` | `components/exam-wizard/exam-wizard.tsx:270` |
| `match_textbook_chunks` | `(p_textbook_id uuid, p_query_embedding vector(2048), p_limit integer default 8, p_document_id uuid default null) -> table(chunk_id, document_id, textbook_id, page_start, page_end, text, relevance_score)` | `lib/textbooks/retrieval.ts:9` |
| `update_exam_and_scheme_atomic` | `(p_exam_id uuid, p_teacher_id uuid, p_expected_revision integer, p_exam_content jsonb, p_marking_content jsonb) -> integer` | `app/actions/exam-editor.ts:59` |
| `claim_ai_generation` | `(p_teacher_id uuid, p_request_key uuid) -> table(outcome text, reservation_id uuid, result_exam_id uuid, result_revision integer)` | `lib/ai/abuse-controls.ts:44` |
| `claim_ai_regeneration` | `(p_teacher_id uuid, p_exam_id uuid, p_slot_id text, p_request_key uuid, p_expected_revision integer) -> same outcome table` | `lib/ai/abuse-controls.ts:59` |
| `persist_generated_exam_and_complete_ai_operation` | `(uuid, uuid, uuid, uuid, uuid, text, integer, integer, text, text, integer, jsonb, jsonb) -> uuid` | `lib/ai/abuse-controls.ts:87` |
| `persist_regenerated_exam_and_complete_ai_operation` | `(uuid, uuid, uuid, uuid, text, integer, jsonb, jsonb) -> integer` | `lib/ai/abuse-controls.ts:118` |
| `fail_ai_operation` | `(p_teacher_id uuid, p_reservation_id uuid) -> boolean` | `lib/ai/abuse-controls.ts:136` |
| `begin_payment_attempt` | `(p_exam_id uuid, p_teacher_id uuid, p_phone text, p_provider text, p_idempotency_key uuid) -> payments row` | `lib/payments/server.ts:55` |
| `acquire_payment_query_lease` | `(p_payment_id uuid, p_lease_token uuid) -> boolean` | `lib/payments/server.ts:76` |
| `complete_payment_query_lease` | `(p_payment_id uuid, p_lease_token uuid) -> boolean` | `lib/payments/server.ts:81` |
| `finalize_verified_payment` | `(p_payment_id uuid, p_exam_id uuid, p_teacher_id uuid, p_provider text, p_amount integer, p_currency text, p_provider_reference text, p_mpesa_receipt text default null, p_result_code text default null, p_result_description text default null) -> boolean` | `lib/payments/server.ts:85` |

These are PostgreSQL functions, not inherently Supabase-specific; replace `.rpc()` with parameterized `SELECT` calls and preserve signatures/atomicity initially.

Database-only helpers with no direct `.rpc()` caller are `is_admin() -> boolean`, `current_teacher_id() -> uuid`, and trigger function `handle_new_user() -> trigger`. They currently depend on `auth.uid()` or `auth.users`.

### D. Supabase Storage

- Bucket: `textbooks`, private, 12,582,912-byte limit, MIME allowlist `application/pdf`; no `storage.objects` policy exists, so service-role-only access is intentional.
- Exact logical object path: `textbooks/{textbook_id UUID}/{document_id UUID}/{safe PDF filename}.pdf`.
- The bucket name is supplied by `lib/textbooks/constants.ts`; because the logical path also starts with `textbooks/`, the Supabase object key is exactly the path above within the `textbooks` bucket.
- Upload: `app/actions/textbooks.ts:82`, `upsert: false`.
- Compensating delete after metadata insert failure: line 89.
- Private processing download: line 105 using persisted `textbook_documents.storage_path`.
- Delete before metadata deletion: line 149; ready/processing documents cannot be removed.
- The database check constraint enforces `^textbooks/[UUID]/[UUID]/[^/]+\.pdf$` and `storage_path` uniqueness.

The target adapter must retain private-by-default access, create-exclusive semantics, MIME/signature/size validation, filename sanitation, path containment, atomic temporary-file write + rename, restrictive ownership/mode, checksum verification, and non-public delivery. Mount it as a persistent volume outside the image (for example `/srv/exam-generator/data/textbooks`); store only relative logical keys in PostgreSQL. Back up database and files as one consistency unit.

### E. Authorization / RLS assumptions

The initial migration enables RLS on all core tables. Ownership policies use `auth.uid()`, `current_teacher_id()`, and `is_admin()`. Curriculum reads are open to the Supabase `authenticated` role; curriculum writes require admin. Teachers can read/update their own profile, read owned exams/payments/marking schemes, and historically had limited exam writes. Security Pass A later revokes client mutation of exams, marking schemes, and most teacher columns. Textbook tables and AI reservations are service-only, with explicit authorization performed before use.

Application replacements required before any policy is removed:

- authenticated principal resolution from a validated Better Auth session;
- teacher/admin role and profile lookup by the preserved user UUID;
- ownership predicates for every teacher exam, payment, marking scheme, document, and PDF path;
- admin gates for curriculum, settings, teacher lists, and textbook management;
- server-only privileged repositories for atomic exam, AI, payment, and RAG operations;
- least-privilege database roles and denial of direct database/public network access;
- uniform not-found behavior for inaccessible resource IDs;
- authorization tests corresponding to every existing RLS policy.

Preferred defense in depth: retain RLS but replace Supabase helpers with transaction-local settings such as `SET LOCAL app.user_id` and `SET LOCAL app.role` exposed only through a transaction wrapper, and rewrite policy helpers to read validated settings. Never accept those settings from browser input. A separate owner-limited runtime DB role and migration role should replace the all-powerful service role. If this proves impractical, application authorization parity must be complete and independently tested before RLS is disabled; removal must be a separate reviewed phase.

### F. Middleware / proxy / session handling

- `proxy.ts` applies `updateSession` to all non-static paths.
- `lib/supabase/middleware.ts` refreshes Supabase cookies, validates `auth.getUser()`, and redirects unauthenticated `/teacher*` and `/admin*` requests.
- `lib/supabase/server.ts` adapts Next.js cookie reads/writes to Supabase SSR.
- `lib/auth/session.ts` caches user and role per render/request.
- `app/teacher/layout.tsx` and `app/admin/layout.tsx` enforce role redirects and load the profile; all nested pages rely on this boundary but sensitive actions also re-check.

Better Auth middleware/session APIs must replace cookie refresh without weakening action-level authorization. Reverse-proxy forwarded headers must be trusted only from the known proxy, and production cookies must remain secure, HTTP-only, and same-site appropriate.

### G. Password recovery / email

- `app/actions/auth.ts` requests reset email and updates the password after validating both a Supabase session and `auth-recovery` cookie.
- `app/auth/callback/route.ts` handles the recovery code.
- `app/(auth)/forgot-password/page.tsx`, `reset-password/page.tsx`, `components/auth/reset-password-form.tsx`, `lib/auth/recovery.ts`, and `lib/auth/recovery.test.ts` comprise the UI/origin safety path.
- `PUBLIC_APP_URL` is canonical; `VERCEL_PROJECT_PRODUCTION_URL` is only a fallback. Production requires HTTPS.

The VPS needs an explicit transactional email provider/SMTP configuration. Better Auth's reset callback must send mail without account enumeration and preserve one-time expiry/revocation. Remove the Vercel fallback only after `PUBLIC_APP_URL` is mandatory and validated.

### H. Textbook / RAG

`app/actions/textbooks.ts` owns authorized upload, SHA-256, PDF extraction, chunking, batch embeddings, vector inserts, processing state, failure cleanup, and deletion policy. `lib/textbooks/*` owns constants, validation, extraction, embedding, retrieval, and generation grounding. `lib/textbooks/retrieval.ts` calls vector similarity RPC; `components/exam-wizard/exam-wizard.tsx` lists ready books; `lib/textbooks/exam-grounding.ts` and `lib/exam-editor/regeneration-grounding.ts` validate subject/grade/document scope.

Preserve `extensions.vector(2048)`, cosine distance operator `<=>`, model/dimension metadata, maximum 12 results in SQL, current application top-K, provenance IDs, PDF limits, and authorization checks. The migration must confirm the pgvector package compatible with PostgreSQL 17 and recreate the `extensions` schema or deliberately schema-qualify a new location.

### I. Payments / Daraja

Daraja is already separated through `PaymentProvider` and `PaymentRepository` in `lib/payments/core.ts`; `DarajaPaymentProvider` is configured in `provider-config.ts`, server persistence is currently `SupabasePaymentRepository`, and callback/reconciliation orchestration is in `daraja-service.ts` and `app/api/payments/mpesa/callback/route.ts`.

Do not rewrite Daraja. Replace only `SupabasePaymentRepository` with a PostgreSQL repository while preserving:

- trusted callback parsing and provider status verification;
- amount/currency/exam/teacher/provider correlation;
- unique generic provider reference and independent M-Pesa receipt;
- idempotency key and one active attempt per exam;
- teacher/exam/phone cooldowns and daily limits;
- advisory-lock ordering;
- query lease token, expiry, attempt cap, and exponential backoff;
- row locks and atomic exam entitlement update;
- accepted states and `downloaded` preservation;
- no persistence of raw callback payloads or secrets.

### J. PDF generation

`app/api/exams/[id]/pdf/route.ts`, `lib/exam-document/load.ts`, `model.ts`, `pdf.tsx`, and document components use Node runtime, `@react-pdf/renderer`, and server-side entitlement checks. `next.config.ts` marks `pdfjs-dist` external and sets Server Action upload size to 13 MB. Docker must include compatible fonts/runtime libraries, sufficient memory, writable temporary space if the libraries require it, and a Node (not edge) runtime. PDF content and payment gating must not change.

### K. Deployment / Vercel assumptions

- `lib/auth/recovery.ts` and its test use `VERCEL_PROJECT_PRODUCTION_URL` fallback.
- `README.md` contains default Vercel deployment guidance and `public/vercel.svg` is a template asset.
- `package.json` exposes `next start`; `next.config.ts` does not currently set `output: "standalone"`.
- There is no `Dockerfile`, Compose file, reverse-proxy config, health/readiness route, VPS runbook, or explicit backup/restore configuration.
- `next.config.ts` has small-runner CPU tuning, a 13 MB Server Action limit needed for 12 MB PDFs, and `pdfjs-dist` externalization. These must be retained and tested in containers.

### L. Environment variables

Current infrastructure variables observed (names only; `.env.local` contents were not inspected or changed):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- `PUBLIC_APP_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `NODE_ENV`.
- `PAYMENT_PROVIDER`, `MPESA_ENVIRONMENT`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_BUSINESS_SHORTCODE`, `MPESA_PARTY_B`, `MPESA_PASSKEY`, `MPESA_TRANSACTION_TYPE`, optional/configured `MPESA_QUERY_URL`.
- `AI_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `GROQ_API_KEY`, `GROQ_MODEL`, `NVIDIA_API_KEY`, `NVIDIA_MODEL`.

Proposed target variables (final names should be documented in an example file without values):

- `DATABASE_URL` for the least-privilege application role; optionally `DATABASE_MIGRATION_URL` available only to migration jobs.
- `BETTER_AUTH_SECRET` (or the current Better Auth rotation form selected during implementation), `BETTER_AUTH_URL`, and `PUBLIC_APP_URL`.
- SMTP/provider settings such as `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`.
- `PRIVATE_STORAGE_ROOT` pointing to the mounted persistent volume.
- `TRUSTED_PROXY_CIDRS` or an equivalent explicit proxy trust setting.
- Existing Daraja and AI variables unchanged.

Retire the three Supabase variables and `VERCEL_PROJECT_PRODUCTION_URL` only after cutover. No database, auth, email, or storage secret may use a `NEXT_PUBLIC_` prefix.

### M. Tests coupled to Supabase

- `lib/security/core.test.ts`: asserts browser/admin Supabase variable boundaries, cookie client structure, and auth-before-admin checks.
- `lib/ai/abuse-controls.test.ts`: reads the AI reservation migration and asserts service-role function protections.
- `lib/exam-editor/core.test.ts`: reads the atomic editor migration and asserts grants/revokes and locking.
- `lib/exam-editor/security.test.ts`: validates editor authorization behavior and should be extended to the new repository.
- `lib/payments/core.test.ts`, `abuse-controls.test.ts`, and `daraja.test.ts`: assert migration-level payment invariants and Daraja correlation/receipt protections.
- `lib/textbooks/security.test.ts`: asserts service-only vector RPC/storage behavior and upload safety.
- `lib/auth/recovery.test.ts`: asserts Vercel fallback and production URL rules.
- `scripts/audit-live-curriculum.mjs` and `import-verified-curriculum.mjs` are operational scripts coupled to service-role PostgREST/RPC.

Replace Supabase-shape assertions with behavior and direct PostgreSQL integration tests. Keep the SQL invariant tests until equivalent PostgreSQL 17 tests prove functions, roles, RLS, locks, leases, idempotency, and pgvector behavior.

## Required PostgreSQL capabilities

- PostgreSQL 17.
- `pgcrypto` for `gen_random_uuid()` as declared by the initial migration (PostgreSQL 17 may expose the function in core, but retain the declared extension until a tested schema cleanup).
- pgvector extension `vector`, installed into schema `extensions`; vector dimension 2048 and `<=>` cosine distance are required.
- PL/pgSQL, JSONB, enum types, partial and expression indexes, triggers, `FOR UPDATE`, `SECURITY DEFINER`, advisory transaction locks, and transaction-local settings if RLS is retained.
- Locale/collation behavior must be assessed for case-insensitive curriculum uniqueness indexes using `lower(name)`; restore to a server with compatible collation.

No repository evidence requires PostGIS, pg_cron, Realtime, Edge Functions, or Supabase Queues.

## Auth-ID preservation strategy

1. Export an immutable mapping of every Supabase `auth.users.id`, normalized email, verification state, created/updated timestamps, and supported credential material using an approved privileged export. Never generate replacement IDs.
2. Create Better Auth core tables in a dedicated schema (for example `better_auth`) and configure UUID database IDs. Better Auth's official database documentation supports `advanced.database.generateId: "uuid"` and PostgreSQL/non-default schemas. Generate migration SQL for review; do not let a CLI mutate production directly.
3. Insert each Better Auth user with `id` exactly equal to the existing Supabase UUID. Preserve `teachers.user_id`, `admins.user_id`, and `textbook_documents.uploaded_by` unchanged.
4. Determine password-hash compatibility with an isolated representative export. Supabase credential hashes must never be exposed to logs or source control. If Better Auth can use an audited verifier for the existing hash, rehash to the target algorithm on successful login; otherwise require a controlled reset for all users. Do not silently weaken hashing.
5. Keep the old identity mapping and counts as cutover evidence. Validate zero orphan profile/document references and one-to-one email/UUID mappings before enabling Better Auth.
6. Replace the `auth.users` foreign keys atomically with references to the UUID Better Auth user table only after all IDs exist. Preserve cascade/restrict semantics.
7. Replace signup trigger behavior with one transaction that creates the Better Auth user/account and teacher profile, or a Better Auth database hook plus compensating failure handling. Preserve name/email fallback and prevent profile-less accounts.
8. Invalidate Supabase sessions at cutover; do not attempt to reinterpret Supabase cookies as Better Auth sessions. Require a fresh login and retain a rollback window.

## Database migration strategy

1. Build a reproducible PostgreSQL 17 + pgvector container locally/staging. Convert the migration history into a self-hosted baseline without editing historical migration files; add future forward-only migrations separately during implementation.
2. Separate Supabase-owned objects (`auth`, `storage`, `anon`, `authenticated`, `service_role`) from portable domain objects. Preserve every domain table, type, constraint, index, function body, and trigger except explicitly mapped auth/storage dependencies.
3. Replace `auth.uid()` / `auth.role()` helpers and grants with the chosen transaction-context RLS model and runtime roles. Harden all `SECURITY DEFINER` functions with fixed search paths, explicit execute grants, and no public database exposure.
4. Continue calling security-critical functions directly through PostgreSQL first. Do not translate Security B1 functions into multi-query TypeScript flows.
5. Perform a rehearsal logical export/restore with schema, auth mapping, sequences (if any), table data, function definitions, and vector values. Compare per-table counts, UUID checksums, constraints, indexes, extensions, and representative vector results.
6. Validate production source consistency with a controlled maintenance/read-only window or snapshot. Use checksummed encrypted transfer, restore into the VPS database, run parity checks, then execute a final delta/cutover procedure.
7. Keep Supabase production unchanged and read-only during the rollback window. Do not dual-write payments, AI reservations, or exam generation unless a formally designed idempotent replication scheme exists.

## Storage migration strategy

1. Introduce a `PrivateObjectStorage` interface with create-exclusive upload, read, and delete; preserve current logical keys.
2. Implement a filesystem adapter rooted at `PRIVATE_STORAGE_ROOT`. Resolve paths beneath the configured root, reject absolute paths, `..`, links, unexpected suffixes, and keys that fail the existing UUID/PDF grammar.
3. Write to a same-filesystem temporary name with restrictive permissions, `fsync` as appropriate, verify SHA-256/size, and atomically rename. Never serve the root through Nginx/Caddy or Next static files.
4. Export the private Supabase bucket through an authorized offline process. For each `textbook_documents` row, download the exact key, verify size and `content_sha256`, place it at the same relative key, and produce a manifest. Missing, extra, or mismatched objects block cutover.
5. Back up files and PostgreSQL on a coordinated schedule; test restore, not just backup creation. Consider filesystem snapshots around database backup boundaries.

## Docker / VPS target architecture

```text
Internet
  -> Caddy or Nginx (TLS, request-size limit >= 13 MB, trusted proxy headers)
       -> Next.js standalone Node container (non-root, health/readiness checks)
            -> PostgreSQL 17 + pgvector on private Docker network
            -> private textbook volume (not web-mounted)
            -> SMTP/email provider
            -> existing Daraja and AI HTTPS APIs

Backup job
  -> encrypted PostgreSQL logical/physical backup
  -> checksummed private-storage snapshot
  -> off-host retention + restore drill
```

PostgreSQL must not publish its port to the public internet. Pin image digests/versions, use health checks and dependency readiness, persist DB and file data on separate named/bind volumes, define CPU/memory limits, centralize redacted logs, rotate secrets outside images, and document patching and disaster recovery. Run schema migration as an explicit one-shot job, never implicitly from every app replica.

## Proposed package changes (not performed)

- Add `better-auth`.
- Add `pg` and its TypeScript types if using Better Auth's built-in PostgreSQL adapter and direct SQL repositories. Avoid adding a second ORM unless its migration/type benefits justify it.
- Remove `@supabase/ssr` and `@supabase/supabase-js` only after all runtime and script callers are migrated.
- Keep `@react-pdf/renderer`, `pdfjs-dist`, `openai`, Next.js, React, and current UI dependencies unchanged during infrastructure phases.
- Add no storage package initially; Node's filesystem APIs are sufficient behind the abstraction. Add an S3-compatible adapter only as a later optional implementation.
- Do not add shadcn/ui packages during this migration; progressive UI work is a later, independently reversible stream.

Version selection and lockfile updates require a separate implementation pass. Better Auth configuration/schema must be generated from the pinned version and reviewed before installation or database changes.

## Exact files expected to need modification

This is a forward plan, not changes made by this audit.

### Core replacement/configuration

- `package.json`, `package-lock.json`, `next.config.ts`, `proxy.ts`, `.gitignore`, `README.md`.
- Replace/remove: `lib/supabase/admin.ts`, `lib/supabase/client.ts`, `lib/supabase/middleware.ts`, `lib/supabase/server.ts`.
- Add future database/auth/storage modules under `lib/db/`, `lib/auth/`, and `lib/storage/`, plus Better Auth route handler(s).
- Add future `Dockerfile`, `.dockerignore`, Compose/deployment files, reverse-proxy configuration, health endpoints, environment example, and operations runbook.

### Auth/session/routes

- `lib/auth/session.ts`, `lib/auth/recovery.ts`, `lib/auth/recovery.test.ts`, `lib/auth/access.ts`, `lib/auth/access.test.ts`.
- `app/actions/auth.ts`, `app/auth/callback/route.ts`, `app/(auth)/forgot-password/page.tsx`, `app/(auth)/reset-password/page.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `components/auth/reset-password-form.tsx`.
- `app/teacher/layout.tsx`, `app/admin/layout.tsx`, `app/actions/exams.ts`, `app/actions/exam-editor.ts`.

### Data access callers

- `app/actions/admin.ts`, `payment-settings.ts`, `payments.ts`, `textbooks.ts`.
- `app/admin/page.tsx`, `curriculum/page.tsx`, `grades/page.tsx`, `subjects/page.tsx`, `teachers/page.tsx`, `textbooks/page.tsx`.
- `app/teacher/dashboard/page.tsx`, `profile/page.tsx`, `transactions/page.tsx`, `exams/page.tsx`, `exams/[id]/edit/page.tsx`.
- `components/exam-wizard/exam-wizard.tsx`.
- `lib/exam-document/load.ts`, `lib/exam-editor/regeneration-grounding.ts`, `lib/textbooks/exam-grounding.ts`, `lib/textbooks/retrieval.ts`, `lib/payments/server.ts`, `lib/ai/abuse-controls.ts`.
- `scripts/audit-live-curriculum.mjs`, `scripts/import-verified-curriculum.mjs`.

### Database and invariant tests

- Add forward-only self-hosted migrations; retain all files under `supabase/migrations/` as historical source evidence.
- Update/add: `lib/security/core.test.ts`, `lib/auth/recovery.test.ts`, `lib/ai/abuse-controls.test.ts`, `lib/exam-editor/core.test.ts`, `lib/exam-editor/security.test.ts`, `lib/payments/core.test.ts`, `lib/payments/abuse-controls.test.ts`, `lib/payments/daraja.test.ts`, `lib/textbooks/security.test.ts`, and PostgreSQL integration tests.

### Deployment-specific files

Existing: `package.json`, `next.config.ts`, `lib/auth/recovery.ts`, `lib/auth/recovery.test.ts`, `README.md`, and template asset `public/vercel.svg`. No current Vercel configuration file exists. Future deployment files are listed above.

## Phased implementation plan and acceptance criteria

### Phase 0 — freeze and reproducible baseline

Create sanitized schema/data manifests, record production extension versions and row/object counts, inventory auth users, and rehearse read-only exports.

Acceptance: no production writes; every required table/function/index/policy/bucket is in the manifest; encrypted backups exist; a restore drill succeeds; UUID and object checksums are recorded.

### Phase 1 — local PostgreSQL 17 parity and repository seam

Create Dockerized PostgreSQL 17 + pgvector, portable baseline migrations, pool/transaction wrapper, and repository interfaces. Initially preserve application behavior and security functions.

Acceptance: clean database bootstrap; all tables/types/functions/indexes present; all existing tests pass; new integration tests prove RLS/roles, atomic editor update, AI quotas/leases/idempotency, payment cooldowns/leases/finalization, and vector retrieval.

### Phase 2 — Better Auth shadow integration

Add Better Auth schema/config in a dedicated schema, ID-preserving import tooling, session/auth adapters, email delivery, and recovery tests. Exercise only in isolated staging.

Acceptance: imported user IDs exactly match Supabase UUIDs; zero orphan FKs; signup creates exactly one teacher profile transactionally; login/logout/verification/reset/session expiry work; admin/teacher separation and cookie/CSRF/origin security pass; password migration/reset strategy is proven.

### Phase 3 — data access and authorization cutover in staging

Move browser queries server-side, replace PostgREST chains and RPC transport with repositories/direct SQL, and implement the approved RLS transaction context or full application authorization parity.

Acceptance: no runtime `@supabase` import or public Supabase variable; every former RLS policy has an explicit tested replacement; inaccessible resources remain indistinguishable from missing ones; database runtime role is least-privilege; Security B1 concurrency tests pass under parallel load.

### Phase 4 — private filesystem storage

Add storage abstraction/filesystem adapter and migrate a staging bucket copy with manifest verification.

Acceptance: exact logical paths preserved; traversal/symlink/overwrite tests pass; all bytes match SHA-256 and size; storage is not publicly addressable; upload/download/cleanup/failure behavior and RAG processing are unchanged; backup/restore drill passes.

### Phase 5 — Docker/VPS staging

Build immutable non-root Next.js standalone image, Compose stack, TLS proxy, health/readiness, migrations job, logging, monitoring, backup, and restore runbook.

Acceptance: fresh VPS deployment from documented steps; no public DB/storage port; 12 MB PDF upload and PDF generation succeed; forwarded-header/cookie behavior is correct; Daraja sandbox callback/reconciliation succeeds; restart and volume persistence tests pass; vulnerability/config review has no critical findings.

### Phase 6 — production cutover

Schedule maintenance, take final consistent exports, restore DB/auth/files, verify manifests, change routing, and monitor. Preserve hosted Supabase/Vercel as read-only rollback targets for the agreed window.

Acceptance: all table/auth/object counts and checksums match; smoke tests pass for both roles, generation/regeneration, textbook RAG, payment and paid PDF entitlement; no duplicate AI/payment operations; monitoring and backups are healthy; rollback decision timer is explicit.

### Phase 7 — decommission and later UI work

After the rollback window and audited backups, retire Supabase/Vercel credentials/services. Begin progressive shadcn/ui adoption separately.

Acceptance: no Supabase/Vercel runtime reference or secret; retention/deletion is approved and documented; UI changes have their own tests and do not overlap infrastructure rollback.

## Migration risks, ordered by severity

1. **Authorization regression during RLS removal/rewrite.** PostgREST currently supplies authenticated/service roles and JWT identity. A normal pool does not. A missed predicate creates cross-tenant access.
2. **Auth UUID or credential loss.** Reissuing IDs breaks three auth foreign keys and audit provenance; mishandling password hashes can lock out users or weaken security.
3. **Payment invariant regression.** Splitting SQL functions into application calls can break row/advisory locking, trusted finalization, receipt uniqueness, cooldowns, daily limits, and reconciliation leases.
4. **AI duplicate/cost abuse.** Generation and regeneration quotas, leases, idempotency, stale-revision checks, and atomic persistence are concurrency controls, not optional business logic.
5. **Database snapshot inconsistency.** Auth, domain rows, payments, and textbook objects must represent one cutover point; uncontrolled live writes create orphans or duplicate operations.
6. **Private storage exposure/data loss.** Path traversal, public reverse-proxy mounts, non-atomic writes, missing backup coordination, or delete ordering can expose or lose copyrighted PDFs.
7. **pgvector parity.** Extension/schema/version, 2048 dimensions, operator semantics, and indexes must survive restore.
8. **VPS operational maturity.** TLS, proxy trust, patching, resource pressure during PDF/RAG work, monitoring, backups, and restore procedures replace managed platform behavior.
9. **Recovery/email deliverability.** Self-hosting auth still requires reliable email, origin safety, token expiry, and anti-enumeration behavior.
10. **Browser query boundary change.** The exam wizard currently talks directly to Supabase; moving it server-side may introduce caching or authorization regressions if not isolated.

## Rollback strategy

- Before cutover, keep production Supabase and Vercel unchanged. Take verified encrypted database/auth/object backups and record DNS/routing TTLs.
- Use a maintenance window to avoid divergent writes. Do not operate uncontrolled active-active writes.
- Define rollback triggers: auth failure rate, checksum/count mismatch, cross-user authorization failure, Daraja verification discrepancy, duplicate AI/payment operation, missing textbook object, failed backup, or sustained critical error/latency.
- If triggered before new-system writes, route traffic back to Vercel/Supabase and invalidate new sessions.
- If the new system accepted writes, stop traffic first. Reconciliation must be operation-specific: export/import only reviewed UUID-keyed domain deltas; reconcile Daraja against provider status and immutable references; never replay callbacks or regenerate exams blindly. If safe reverse replication is not prebuilt and rehearsed, extend maintenance instead of risking double effects.
- Preserve logs/manifests and conduct incident review. No hosted dependency is decommissioned until rollback expiry and explicit approval.

## Exact next recommended implementation step

Build Phase 1 as an isolated local/staging PostgreSQL 17 + pgvector parity harness: create a new forward-only portable schema baseline and integration tests for extensions, all 13 application-invoked functions, the three database-only auth helpers/trigger replacements, RLS transaction identity, Security B1 concurrency invariants, and vector retrieval. Do not connect the application or production yet. This de-risks the database/security foundation before adding Better Auth, because Better Auth's UUID schema and foreign-key cutover must land on a proven target database.

## Reference notes

- Better Auth PostgreSQL adapter: <https://better-auth.com/docs/adapters/postgresql>
- Better Auth database schema and UUID generation: <https://better-auth.com/docs/concepts/database>
- Better Auth installation/auth methods: <https://better-auth.com/docs/installation>

These links were current at audit time; pin and re-check documentation against the chosen package version during implementation.
