# Self-Hosted Database Parity Harness

Status: local development harness only. This phase does not connect to or modify production Supabase, authentication, storage, Daraja, AI providers, application queries, or Vercel deployment.

## Architecture

`docker-compose.selfhosted.yml` starts one database container on an internal Docker network with no published host port. PostgreSQL data is held in the explicitly named local development volume `exam-generator-selfhosted-parity-postgres17`. Tests run through `docker compose exec`, so PostgreSQL does not need host exposure.

The database image is `pgvector/pgvector:0.8.6-pg17-bookworm`, an official pgvector image based on PostgreSQL 17. The tag pins pgvector 0.8.6 rather than tracking a floating tag. The database healthcheck requires both `pg_isready` and an installed `vector` extension.

```text
host command
  -> docker compose exec
       -> PostgreSQL 17 + pgvector 0.8.6 container
            -> internal-only Docker network
            -> persistent local parity volume
            -> temporary compatibility schemas
            -> verbatim current migration replay
            -> direct psql parity tests
```

## Extensions and PostgreSQL features

- `pgcrypto`, enabled by the existing initial migration.
- `vector`/pgvector, installed in the existing `extensions` schema by the textbook RAG migration.
- Existing `extensions.vector(2048)` textbook embeddings and cosine distance operator `<=>` are retained.
- PL/pgSQL, JSONB, UUID primary keys, enums, foreign keys, checks, expression/partial/unique indexes, triggers, RLS, row locks, advisory transaction locks, and security-definer functions are standard PostgreSQL features and replay unchanged.

The current migrations do not define an approximate vector index on `textbook_chunks`. The application function performs an exact cosine search. The parity suite inserts deterministic 2048-dimensional vectors and tests exact ordering. It separately creates a small three-dimensional HNSW cosine index to prove the image supports the index access method/operator class. This separation is intentional: pgvector's HNSW `vector` index has a lower dimension ceiling than the application's 2048-dimensional column. A future indexing decision must not change embedding dimension or search semantics casually.

## Bootstrap strategy

Docker's first-start initialization runs:

1. `infra/self-hosted/bootstrap/00-supabase-compatibility.sql`.
2. Every existing `supabase/migrations/*.sql` file in filename order through `10-apply-current-migrations.sh`.
3. A version/extension report.

Existing migration files are not copied, edited, or reimplemented. The bootstrap mounts them read-only and applies them verbatim. Destroying and recreating the named local volume gives a clean replay.

The compatibility bootstrap uses the PostgreSQL keyword/value `current_user` without schema qualification. An initial local version incorrectly used `pg_catalog.current_user`; PostgreSQL rejected that form because `current_user` is not a schema-qualified function. Correcting it to `current_user` allowed the clean bootstrap and migration replay to complete.

### Temporary Supabase compatibility objects

The migration history cannot run on an empty ordinary PostgreSQL cluster because Supabase normally pre-creates platform objects. The prelude therefore creates only:

- non-login roles `anon`, `authenticated`, and `service_role` (`service_role` has `BYPASSRLS` to reproduce the current local test semantics);
- schemas `auth`, `storage`, and `extensions`;
- a minimal `auth.users` table containing only `id`, `email`, `raw_user_meta_data`, and `created_at`;
- `auth.uid()` and `auth.role()` backed by local `request.jwt.claim.*` settings;
- the minimal `storage.buckets` columns used by the textbook bucket migration;
- Supabase-like default public-schema privileges established before migration replay, allowing the existing later `REVOKE` statements to remain authoritative.

These objects are prominently commented as temporary. They do not implement GoTrue, password credentials, sessions, tokens, email, object storage, or the future Better Auth model. Synthetic `auth.users` rows exist solely to satisfy the three current UUID foreign keys and exercise the signup trigger/RLS in local tests.

## Feature classification

### A. Standard PostgreSQL

All domain tables and constraints; UUID/JSONB/enums; triggers; RLS; PL/pgSQL; security-definer/invoker functions; partial/expression indexes; row locking; advisory locking; quota windows; idempotency uniqueness; exam revisions; payment finalization; and transaction atomicity.

### B. pgvector-dependent

`textbook_chunks.embedding extensions.vector(2048)`, vector literals/casts, cosine distance `<=>`, `match_textbook_chunks`, and optional vector index access methods/operator classes.

### C. Supabase role/grant-dependent

References to roles `anon`, `authenticated`, and `service_role`; broad platform default privileges assumed by early migrations; later explicit grants/revokes; `service_role` RLS bypass; and `auth.role()` checks inside curriculum/RAG functions.

### D. Supabase auth-schema-dependent

The three foreign keys to `auth.users`, `handle_new_user()` trigger, `auth.uid()` ownership helpers/policies, and metadata fields read during teacher creation. The temporary compatibility schema is not a final solution.

### E. Supabase Storage-dependent

Only the `storage.buckets` insert in the RAG migration is required for schema replay. No `storage.objects` policy or object operation is exercised. Filesystem migration is deliberately out of scope.

### F. Safe unchanged on standalone PostgreSQL

The 13 application-invoked business functions and their locking/constraint logic are ordinary PostgreSQL once their role/auth checks are supplied. Direct SQL replaces only the future transport mechanism; function bodies need not be translated into TypeScript.

### G. Requires later compatibility work

- Replace temporary `auth.uid()/role()` claim settings with a validated application transaction context or reviewed application authorization layer.
- Replace `auth.users` foreign keys while preserving every UUID and delete behavior during the Better Auth phase.
- Replace Supabase role defaults with deliberately scoped runtime/migration roles.
- Remove `storage.buckets` from the portable baseline during the later storage phase.
- Decide whether 2048-dimensional exact retrieval remains sufficient or whether a supported approximate-index representation can be introduced without semantic/quality regression.
- Replace PostgREST `.rpc()` transport and query builders only in the application abstraction phase.

## Direct function/RPC parity coverage

`infra/self-hosted/tests/rpc-and-security-b1.sql` resolves the exact signatures and invokes all functional categories directly through PostgreSQL:

1. `import_verified_curriculum(jsonb)` — verifies the service-role guard and payload-schema rejection directly. A full import remains covered by the existing locked dataset workflow; the parity suite intentionally does not duplicate the 141-context/large curriculum payload.
2. `list_ready_textbooks(uuid, uuid)` — positive authenticated synthetic result.
3. `match_textbook_chunks(uuid, vector, integer, uuid)` — positive deterministic 2048-dimensional similarity result.
4. `update_exam_and_scheme_atomic(...)` — success plus stale revision failure.
5. `claim_ai_generation(uuid, uuid)` — acquisition, replay, busy, expiry, and quota.
6. `claim_ai_regeneration(...)` — acquisition, busy, stale revision, and quota.
7. `persist_generated_exam_and_complete_ai_operation(...)` — atomic exam/scheme/reservation completion.
8. `persist_regenerated_exam_and_complete_ai_operation(...)` — atomic content/scheme/revision/reservation update.
9. `fail_ai_operation(uuid, uuid)` — success and idempotent repeat.
10. `begin_payment_attempt(...)` — creation, active reuse, cooldowns, and daily limits.
11. `acquire_payment_query_lease(uuid, uuid)` — acquisition, contention rejection, and attempt cap.
12. `complete_payment_query_lease(uuid, uuid)` — token ownership, cleanup, and backoff.
13. `finalize_verified_payment(...)` — trusted success, idempotent replay, mismatch rejection, uniqueness, and one unlock.

`infra/self-hosted/tests/concurrency.sh` opens independent PostgreSQL sessions and proves both the unique active-generation-per-teacher and active-regeneration-per-exam invariants permit exactly one acquisition while blocking the competing request.

## Security B1 coverage

### AI generation

- one active generation per teacher;
- request-key replay behavior;
- daily quota;
- expired reservation reclamation;
- atomic exam, marking scheme, and reservation completion.

### AI regeneration

- active regeneration exclusion;
- stale revision rejection;
- daily quota;
- atomic marking/exam revision and reservation completion;
- explicit operation failure behavior.

### Payments

- active-attempt reuse before quota consumption;
- teacher, exam, and phone cooldowns;
- teacher, exam, and phone daily limits;
- query lease exclusivity, completion, next-at backoff, and maximum attempts;
- amount/currency/ownership correlation;
- provider-reference and receipt uniqueness;
- finalization replay rules;
- exactly one paid payment and exam entitlement unlock.

The tests use only synthetic UUIDs, phone numbers, JSON, and vectors. They do not call Daraja or any external API.

## Current execution result

The local self-hosted parity harness completed successfully on 2026-08-26 after destroying and recreating only its disposable named volume. The observed runtime was PostgreSQL `17.11 (Debian 17.11-1.pgdg12+2)`, with `pgcrypto` `1.3` and `vector`/pgvector `0.8.6`.

Repository-level results on 2026-08-26:

| Check | Result |
|---|---|
| Harness shell syntax/readability | PASS |
| Existing focused AI/editor/payment/textbook database tests | PASS — 7/7 files |
| PostgreSQL healthcheck/bootstrap | PASS — PostgreSQL 17.11, `pgcrypto` 1.3, pgvector 0.8.6 |
| All 13 direct RPC/function signatures | PASS |
| Security B1 parity | PASS |
| RLS compatibility | PASS |
| Vector parity | PASS |
| Concurrent AI generation | PASS — one acquired, one blocked |
| Concurrent AI regeneration | PASS — one acquired, one blocked |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS |
| `npx next build --webpack` | PASS |
| `git diff --check` | PASS |
| Known `lib/security/core.test.ts` assertion | PRE-EXISTING FAIL — expects `createAdminClient()` text inside `app/actions/exams.ts` |

## Commands

Start and wait for the isolated database:

```bash
docker compose -f docker-compose.selfhosted.yml up -d --wait database
```

Run schema/RPC/Security B1/vector/concurrency parity:

```bash
./infra/self-hosted/run-parity-tests.sh
```

Inspect versions:

```bash
docker compose -f docker-compose.selfhosted.yml exec -T database \
  bash -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select version(); select extname, extversion from pg_extension where extname in ('"'"'pgcrypto'"'"', '"'"'vector'"'"');"'
```

Stop containers while retaining local test data:

```bash
docker compose -f docker-compose.selfhosted.yml down
```

Destroy **only the explicitly named LOCAL parity containers/network/volume**:

```bash
docker compose -f docker-compose.selfhosted.yml down --volumes --remove-orphans
```

The destroy command permanently deletes `exam-generator-selfhosted-parity-postgres17`. It must never be pointed at another Compose file/project or production host.

## Files created or modified in this phase

Created:

- `docker-compose.selfhosted.yml`
- `infra/self-hosted/.env.selfhosted.example`
- `infra/self-hosted/bootstrap/00-supabase-compatibility.sql`
- `infra/self-hosted/bootstrap/10-apply-current-migrations.sh`
- `infra/self-hosted/run-parity-tests.sh`
- `infra/self-hosted/tests/rpc-and-security-b1.sql`
- `infra/self-hosted/tests/concurrency.sh`
- `docs/SELF_HOSTED_DATABASE_PARITY.md`

No existing application, migration, package, lockfile, environment, auth, storage, payment, AI, or deployment file was modified.

## Rollback

The harness is additive. Stop it with `docker compose ... down`; remove only its local volume with the explicit destroy command above. Repository rollback should target only the harness/documentation commit after review; never reset or overwrite unrelated work. Production rollback is unnecessary because production is never contacted.

## Stop point and exact next phase

Every required runtime parity check is now green, so it is safe to begin the **application database abstraction phase** after this checkpoint is reviewed: introduce a server-only PostgreSQL pool/transaction boundary and repository interfaces behind unchanged application behavior, starting with a low-risk read path. This phase stops before beginning that work. Better Auth and filesystem storage remain later phases.
