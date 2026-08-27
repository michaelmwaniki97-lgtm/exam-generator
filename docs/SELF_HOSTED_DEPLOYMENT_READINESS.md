# Self-Hosted Deployment Readiness

Status: Phase 11 source/runtime dependency gate. This does **not** deploy or modify production.

## Accepted runtime target

A self-hosted deployment is considered configuration-ready only when all of these are explicit:

- `DATABASE_BACKEND=postgres` with a server-only PostgreSQL `DATABASE_URL`.
- `AUTH_BACKEND=better-auth`, `AUTH_CUTOVER_STATE=accepted`, `AUTH_MUTATION_MODE=normal`.
- `PUBLIC_APP_URL` and `BETTER_AUTH_URL` share the same HTTPS origin in production.
- Better Auth secret and SMTP recovery configuration are present.
- `TEXTBOOK_STORAGE_BACKEND=filesystem` and `TEXTBOOK_STORAGE_ROOT` is an absolute private directory.
- one explicit AI provider is selected and its server-only API key is present.
- `PAYMENT_PROVIDER=daraja` has the reviewed Daraja configuration; production query traffic is pinned to the verified Safaricom host.

Run the environment/source gate with:

```bash
npm run selfhosted:check
```

The command prints only provider names, modes, booleans, and dependency counts. It does not print secrets, URLs containing credentials, user data, password hashes, or database contents.

## Phase 11 dependency result

The accepted PostgreSQL/Better Auth/filesystem runtime has no direct application entrypoint that must initialize a Supabase client. The accidental `app/actions/admin.ts` client creation was removed; admin actions now authorize first and then use the already-migrated repository layer.

The payment server implementation is transport-neutral and is now named `ServerPaymentRepository`. Its database operations already delegate to the database/RPC/read/write repository abstractions, so the old `SupabasePaymentRepository` name no longer falsely implies a hosted Supabase requirement.

The source audit blocks checkpointing if it finds:

- direct Supabase imports in application/component entrypoints outside the guarded legacy PKCE callback;
- direct PostgREST `.from(...)` calls outside reviewed fallback adapters;
- direct Supabase Storage calls outside the storage fallback adapter;
- direct Supabase Auth calls outside the guarded legacy Auth adapter/middleware/callback.

Two Supabase-only curriculum maintenance scripts are intentionally retained for the hosted rollback/source system:

- `scripts/audit-live-curriculum.mjs`
- `scripts/import-verified-curriculum.mjs`

They are not runtime application dependencies and must not be used as self-hosted production administration tools after Supabase is decommissioned. A later decommission cleanup can port or remove them together with the retained fallback adapters and Supabase packages.

The repository still contains 18 `lib/**/supabase.ts` fallback/legacy adapters. They remain useful through the broader database/storage rollback window, but the accepted self-hosted environment selects PostgreSQL/Better Auth/filesystem and does not require Supabase credentials for ordinary application traffic.

## Parity Docker correction

The local parity database keeps its private internal network and now also joins a non-internal host-access network. The published PostgreSQL port remains bound to `127.0.0.1` only. This avoids the Docker behavior observed during Auth integration where an internal-only network left the configured host port inactive until a second bridge network was attached manually.

This change is for the local parity harness only; the future VPS production database must not publish PostgreSQL to the public host interface.

## What is still missing before VPS deployment

Phase 11 intentionally does not create production infrastructure. The next deployment slice still needs:

1. a production Next.js container image (non-root, reproducible, with the current PDF/runtime requirements preserved);
2. a production Compose stack containing the app, PostgreSQL 17 + pgvector, private textbook volume, and explicit health/readiness checks;
3. Caddy/TLS configuration with the application as the only public service;
4. an explicit migration/bootstrap job rather than application-start schema mutation;
5. backup + restore scripts/runbook for PostgreSQL and textbook files as one logical recovery set;
6. staging smoke tests for teacher/admin auth, exam generation/regeneration, textbook RAG, Daraja sandbox, and paid PDF download;
7. final data/auth/storage export-import and production cutover runbook.

Supabase/Vercel must remain untouched until the staging stack and restore drill pass.

## Phase 12 production-shaped stack

Phase 12 adds `Dockerfile.selfhosted`, `docker-compose.production.yml`, `deploy/Caddyfile`, an explicit ledgered schema-bootstrap job, Docker-secret-backed runtime configuration, and a minimal PostgreSQL-aware `/api/health` endpoint. The production Compose file does not publish PostgreSQL or the Next.js service; only Caddy binds host ports 80/443. See `docs/SELF_HOSTED_VPS_STACK.md` for operator steps.

The local parity Compose file remains a separate developer/integration harness. Its loopback PostgreSQL port and hardcoded parity-only runtime credential must never be copied into the VPS stack.
