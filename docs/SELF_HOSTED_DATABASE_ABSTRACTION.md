# Self-Hosted Database Abstraction — RPC Foundation

Status: RPC foundation checkpointed; CRUD Phase 1 (read-only grades and subjects) is under review and uncommitted. Production behavior still defaults to Supabase. Authentication, storage, production data, Daraja, and deployment are unchanged.

## CRUD Phase 1: grades and subjects

`lib/catalog` is a narrow, server-only repository for the existing grades/subjects read shapes. It does not expose arbitrary tables, SQL, the PostgreSQL Pool, trusted RPC execution, or write methods. The methods are `listWizardGrades`, `listGradesByCreation`, `listGradeOptionsByName`, `listGradeNames`, `getGradeById`, `gradeExists`, `listSubjectsByName`, `listSubjectNames`, `getSubjectById`, `subjectExists`, and `countSubjects`.

The Supabase implementation retains the original explicit projections, filters, null normalization, and ordering. The PostgreSQL implementation uses the existing bounded pool and authenticated transaction helper with explicit columns. Its SQL is limited to `public.grades` and `public.subjects`; ID lookups use `$1::uuid`, and no query uses `SELECT *`.

Both tables are globally readable to the current `authenticated` role under the existing `grades_select_all` and `subjects_select_all` policies. They are not anonymous/public catalog endpoints. `getCatalogRepository()` first validates the current Supabase session with `auth.getUser()` and accepts no caller-provided user ID, role, backend, request, headers, cookies, or form data. The direct adapter receives only the server-derived `user.id`. Admin and teacher route guards remain unchanged, and the repository has no trusted/service-only capability.

Migrated runtime reads are:

- wizard grade loading in `components/exam-wizard/exam-wizard.tsx`, now through `app/actions/catalog.ts`; the neighboring strands browser query is unchanged;
- grade and subject validation in `app/actions/exams.ts`;
- grade/subject lists in the admin grades, subjects, curriculum, and textbook pages;
- the admin dashboard subject count;
- duplicate/existence reads used by subject and grade create/update actions (the writes remain Supabase);
- grade/subject existence validation for textbook creation (all textbook reads/writes and Storage remain Supabase).

Contract tests verify the default Supabase selection, exact Supabase projections/order, wizard `sort_order` null normalization, environment-only backend choice, and the server-only authenticated boundary. Direct PostgreSQL integration tests use only synthetic parity-container data and verify field shapes, ordering, unique/empty behavior, ID parameters, counts, and denial to a connection without authenticated identity.

Maintenance-only curriculum audit/import scripts retain their existing service-path reads. The delete mutations' `.select("id")` return clauses are writes and are also intentionally unchanged. All other ordinary `.from()` calls—including strands, curriculum hierarchy, textbooks/documents/chunks, exams, payments, teachers/admins, settings, and AI reservations—remain out of scope.

Rollback is configuration-first: omit `DATABASE_BACKEND` or set it to `supabase`. Before checkpoint, discard only the reviewed CRUD Phase 1 files/hunks; after checkpoint, revert only that commit. No database rollback is required because this phase adds no schema or production-data changes.

The recommended next CRUD slice, after review and checkpoint, is read-only strands/sub-strands/learning outcomes as a separate curriculum repository. It should preserve active-state filters, nested result normalization, authenticated access, and current ordering. Do not combine that slice with writes, Better Auth, or Storage.

## Design

The abstraction is intentionally narrow: `AuthenticatedRpcDatabase` contains the one authenticated-user RPC, while `TrustedRpcDatabase` contains the 12 existing service-only operations. Callers select business methods, never arbitrary function names, SQL, database roles, or backend names. `lib/db/index.ts` is the server-only factory.

`pg` was chosen instead of Drizzle because the business invariants already live in tested PostgreSQL functions using row/advisory locks, atomic transactions, RLS, JSONB, and pgvector. This phase replaces transport without redesigning those functions or introducing a second schema model.

## Backend selection

`DATABASE_BACKEND` accepts only `supabase` or `postgres`:

- missing or `supabase`: existing Supabase/PostgREST RPC transport;
- `postgres`: parameterized node-postgres calls to the same function signatures.

The default is deliberately `supabase`, so deployment behavior does not change unless a server operator explicitly opts in. Backend selection is read only from server environment configuration and is not accepted from actions, routes, forms, query strings, or other browser-controlled values.

## Environment variables

```dotenv
DATABASE_BACKEND=supabase
DATABASE_URL=
```

`DATABASE_URL` is required only for the PostgreSQL backend. It is server-only and must never use a `NEXT_PUBLIC_` prefix. `.env.example` contains placeholders only. The local parity example contains synthetic disposable credentials; no production URL is committed.

## Direct PostgreSQL pool

`lib/db/postgres-client.ts` owns a development/HMR-safe global `pg.Pool` singleton. It has a maximum of 10 connections, a 5-second connection timeout, 30-second idle timeout, 30-minute connection lifetime, and 15-second query/statement timeouts. Each identity-bearing operation also applies a 10-second idle-in-transaction timeout. Connections are always released, failed transactions roll back, production signal handlers close the pool, and tests can explicitly close it.

The Pool is never exported through a client component or public endpoint. The URL is read only while constructing the server pool; credentials and query parameters are never logged.

## Identity and RLS propagation

Authenticated work uses one short transaction:

```text
BEGIN
SET LOCAL ROLE authenticated
set_config('request.jwt.claim.sub', validated Supabase user UUID, true)
set_config('request.jwt.claim.role', 'authenticated', true)
...parameterized operation...
COMMIT
```

The user UUID comes from the existing server-side `supabase.auth.getUser()` session validation, not from the browser action arguments. This matches the current compatibility `auth.uid()` and `auth.role()` implementations. Values use query parameters, and the role name is a fixed SQL literal.

The trusted factory is separate. It uses only the fixed `service_role` and its fixed local claim inside a transaction. No public API accepts a role or chooses between authenticated and trusted execution. This preserves current EXECUTE restrictions: an authenticated transaction cannot call service-only functions, and a connection without an explicit identity role cannot call the authenticated function.

The local harness adds `exam_app_runtime`, a non-superuser `NOINHERIT` login used only for integration testing. It may enter the two compatibility roles because this transition is still an interim Supabase-compatible boundary. A later reviewed role-hardening phase should replace the broad compatibility `service_role`/`BYPASSRLS` model with purpose-specific runtime roles; the application login must not become a superuser.

## The 13 operations

| Typed method | PostgreSQL function | Boundary |
|---|---|---|
| `importVerifiedCurriculum` | `import_verified_curriculum(jsonb)` | trusted |
| `listReadyTextbooks` | `list_ready_textbooks(uuid, uuid)` | authenticated |
| `matchTextbookChunks` | `match_textbook_chunks(uuid, vector(2048), integer, uuid)` | trusted |
| `updateExamAndSchemeAtomic` | `update_exam_and_scheme_atomic(uuid, uuid, integer, jsonb, jsonb)` | trusted |
| `claimAiGeneration` | `claim_ai_generation(uuid, uuid)` | trusted |
| `claimAiRegeneration` | `claim_ai_regeneration(uuid, uuid, text, uuid, integer)` | trusted |
| `persistGeneratedExam` | `persist_generated_exam_and_complete_ai_operation(uuid, uuid, uuid, uuid, uuid, text, integer, integer, text, text, integer, jsonb, jsonb)` | trusted |
| `persistRegeneratedExam` | `persist_regenerated_exam_and_complete_ai_operation(uuid, uuid, uuid, uuid, text, integer, jsonb, jsonb)` | trusted |
| `failAiOperation` | `fail_ai_operation(uuid, uuid)` | trusted |
| `beginPaymentAttempt` | `begin_payment_attempt(uuid, uuid, text, text, uuid)` | trusted |
| `acquirePaymentQueryLease` | `acquire_payment_query_lease(uuid, uuid)` | trusted |
| `completePaymentQueryLease` | `complete_payment_query_lease(uuid, uuid)` | trusted |
| `finalizeVerifiedPayment` | `finalize_verified_payment(uuid, uuid, uuid, text, integer, text, text, text, text, text)` | trusted |

## Implementations and normalization

The Supabase adapter retains `.rpc()` with the exact existing named arguments. The PostgreSQL adapter uses schema-qualified, positional, parameterized `SELECT` statements with explicit casts matching the migration signatures. JSON values remain JSONB, vectors remain 2048-dimensional pgvector literals, null defaults remain null, and table-returning functions remain row arrays.

Both adapters expose the same application-level shapes: arrays for textbook/claim/vector results, one payment row for `beginPaymentAttempt`, scalars for UUID/revision/boolean functions, and a normalized `DatabaseRpcError` containing the safe PostgreSQL/PostgREST code and message required by editor stale-revision handling.

The browser textbook RPC moved to an authenticated server action. Remaining Supabase `.from()` calls, session/auth calls, and Storage calls are intentionally unchanged.

## Tests and security evidence

The Supabase contract test verifies the default backend and all 13 exact RPC mappings without production access. The PostgreSQL integration test uses synthetic fixtures in the disposable parity database and verifies:

- all 13 methods, including negative curriculum input;
- generation/regeneration acquisition, atomic persistence, failure, and revision behavior;
- editor ownership and stale/incorrect-owner rejection;
- payment initiation, lease acquisition/completion, trusted correlation, finalization, and mismatch rejection;
- deterministic 2048-dimensional vector retrieval;
- Teacher A can see an owned exam while Teacher B cannot;
- an unauthenticated connection cannot execute the authenticated textbook function;
- an authenticated transaction cannot execute a service-only function;
- backend/role selection is not exposed as a browser-controlled argument.

The original parity harness remains the authoritative full Security B1, RLS, pgvector, and concurrency suite.

## Local commands

```bash
bash ./infra/self-hosted/run-parity-tests.sh
DATABASE_BACKEND=supabase node --conditions react-server --test --experimental-strip-types lib/db/rpc-contract.test.ts
DATABASE_BACKEND=postgres DATABASE_URL='postgresql://exam_app_runtime:local-parity-runtime-only@127.0.0.1:55432/exam_generator_parity' \
  node --conditions react-server --test --experimental-strip-types lib/db/postgres-rpc.integration.test.ts
```

Some nested/containerized development hosts do not activate Docker's loopback proxy even when the binding is configured. In that environment only, obtain the disposable container's private address with `docker inspect` and substitute it for `127.0.0.1:55432`. Never substitute a production Supabase database URL.

## Remaining Supabase dependencies

Supabase remains the default RPC transport and still supplies authentication/session cookies, all ordinary `.from()` CRUD, browser curriculum reads, admin helpers, private Storage, password recovery, and production database hosting. The payment repository is intentionally hybrid under the PostgreSQL RPC option: only its four RPC calls use the abstraction while ordinary row reads/updates remain Supabase in this phase.

## Rollback and next step

Rollback is configuration-first: unset `DATABASE_BACKEND` or set it to `supabase`. Before a checkpoint commit, all changes are ordinary worktree edits. After a checkpoint, revert only that reviewed commit; do not reset unrelated work. No production database rollback is needed because this phase performs no production writes or migrations.

After review and checkpoint, the next recommended step is a separate, low-risk ordinary-CRUD repository phase, beginning with a server-only read path and explicit authorization parity. Do not begin Better Auth or Storage migration until CRUD/RLS coverage and least-privilege runtime-role design are separately reviewed.
