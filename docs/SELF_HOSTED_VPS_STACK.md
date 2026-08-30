# Self-Hosted VPS Stack — Phase 12

Status: production-shaped Docker/Caddy stack, still **not deployed to production**.

> This is the Phase 12 implementation record. Use
> [`PRODUCTION_DEPLOYMENT_RUNBOOK.md`](PRODUCTION_DEPLOYMENT_RUNBOOK.md) as the
> authoritative final deployment, migration, acceptance, rollback, and
> troubleshooting procedure. In particular, the final runbook corrects the
> ordering of pre-FK Auth import readiness versus post-FK traffic readiness.

## Architecture

Only Caddy publishes host ports. Caddy terminates TLS on 80/443 and proxies to the Next.js app on an internal Docker service port. The app has outbound access for SMTP, AI providers, and Daraja, plus a separate internal-only network to PostgreSQL. PostgreSQL has no host port in the production Compose file.

Persistent state is split into named volumes:

- `postgres_data` — PostgreSQL 17 + pgvector data;
- `textbook_files` — private PDF source files mounted at `/data/textbooks`;
- `next_cache` — single-instance Next.js runtime cache;
- `caddy_data` / `caddy_config` — ACME certificates and Caddy state.

The app image uses Next.js standalone output and runs as UID/GID 10001 rather than root. The container includes CA certificates and DejaVu/fontconfig runtime support for outbound TLS and PDF/font handling. `pdfjs-dist` remains server-external and is explicitly included in output tracing.

## Secrets

Do not put live secrets in `deploy/selfhosted.env`. That file is for non-secret modes, hostnames, model names, and paths.

Create these untracked files on the VPS:

```bash
cp deploy/selfhosted.env.example deploy/selfhosted.env
cp deploy/secrets/postgres_owner_password.example deploy/secrets/postgres_owner_password
cp deploy/secrets/runtime.env.example deploy/secrets/runtime.env
chmod 600 deploy/selfhosted.env deploy/secrets/postgres_owner_password deploy/secrets/runtime.env
```

`runtime.env` is mounted as a Docker secret and loaded inside the app process. It carries `DATABASE_URL`, `BETTER_AUTH_SECRET`, SMTP credentials, selected AI key, and Daraja secrets. The database owner password is a separate secret and must differ from the application runtime password.

The `DATABASE_URL` must use `exam_app_runtime` and the Docker hostname `database`. Percent-encode special characters in the URL password. The application must never use the database owner account.

## DNS and firewall

Before requesting public certificates:

1. Point the deployment hostname A/AAAA record at the VPS.
2. Allow SSH only from the operator's intended source where practical.
3. Allow public TCP 80 and TCP/UDP 443.
4. Do **not** open PostgreSQL 5432 or Next.js 3000 on the VPS firewall.

Caddy obtains and renews HTTPS certificates automatically when `APP_DOMAIN` resolves to the server and ports 80/443 are reachable.

## Validate before starting anything

From the repository root:

```bash
docker compose \
  --env-file deploy/selfhosted.env \
  -f docker-compose.production.yml \
  config
```

The rendered config must show public ports only under `caddy`.

Build the application image separately before touching data:

```bash
docker compose \
  --env-file deploy/selfhosted.env \
  -f docker-compose.production.yml \
  build app
```

## Explicit schema bootstrap

Schema mutation is **not** tied to app startup and is **not** mounted under PostgreSQL's `docker-entrypoint-initdb.d` in production.

For a new empty staging/production target:

```bash
docker compose --env-file deploy/selfhosted.env -f docker-compose.production.yml up -d database

docker compose --env-file deploy/selfhosted.env -f docker-compose.production.yml \
  --profile ops run --rm schema-bootstrap
```

The bootstrap:

- creates the transitional roles/helpers needed to replay the historical migrations without any hardcoded password;
- applies `supabase/migrations/*.sql` then `infra/self-hosted/auth/*.sql`;
- records the SHA-256 of each applied migration in `selfhosted_meta.schema_migrations`;
- skips an already-applied migration only when its checksum is unchanged;
- applies each migration and its ledger entry in one transaction;
- never auto-applies the manual Better Auth FK cutover under `infra/self-hosted/auth-cutover/`.

Do not run this bootstrap against an arbitrary restored database that did not originate from this ledgered bootstrap process. The final cutover runbook must define whether the target is built schema-first then data-imported, or restored from a validated backup.

## Starting the application

Do not start public traffic until the data/Auth/Storage import and cutover acceptance gates are complete. When they are:

```bash
docker compose --env-file deploy/selfhosted.env -f docker-compose.production.yml up -d app caddy
```

The app health check calls `/api/health`, which returns only `ok`/`unavailable` and verifies PostgreSQL connectivity when `DATABASE_BACKEND=postgres`. Caddy also uses that endpoint for upstream health.

## Why this structure

Next.js recommends a reverse proxy in front of a self-hosted server, and its standalone output copies the traced production runtime into a minimal server bundle. Caddy provides automatic HTTPS and reverse proxy health checking. Docker Compose waits on services marked `service_healthy`; this stack uses that for database → app → Caddy startup ordering.

## Still required after Phase 12

Phase 12 makes the repository deployable but deliberately does not perform the real cutover. Remaining operational work is:

1. backup + restore tooling and a successful restore drill;
2. production data export/import and count/checksum reconciliation;
3. Better Auth final delta import + manual identity FK cutover;
4. textbook file export/import + hash reconciliation;
5. staging smoke tests including Daraja sandbox and paid PDF download;
6. DNS/traffic cutover, acceptance window, and only then Supabase/Vercel decommission.

## Production cutover operator tooling

The deployment stack intentionally keeps source Supabase credentials out of committed files and out of the application runtime secret. The final migration uses short-lived operator environment variables and writes sensitive cutover artifacts outside the repository by default (`/tmp/exam-generator-cutover`, mode `0700`).

Required source variables during the export window:

```bash
export SOURCE_DATABASE_URL='<Supabase direct or session-pooler PostgreSQL URL with sslmode=require>'
export SOURCE_SUPABASE_URL='https://<project-ref>.supabase.co'
export SOURCE_SUPABASE_SERVICE_ROLE_KEY='<temporary privileged server-side key>'
```

Do not put these values in Git, `deploy/selfhosted.env`, browser code, screenshots, or shell scripts. The service-role key is used only by the operator export container for private Storage downloads and should be rotated/revoked when Supabase is retired.

### Cutover order

1. Put the old production application into the agreed maintenance/freeze window so source writes stop.
2. Export a final source snapshot:
   `npm run selfhosted:export-source`
3. Bootstrap the fresh target database with the reviewed production schema job.
4. Dry-run then apply the temporary `auth.users` identity bridge:
   `npm run selfhosted:seed-auth-bridge`
   then `npm run selfhosted:seed-auth-bridge -- --apply`
5. Dry-run then apply public application data:
   `npm run selfhosted:import-data`
   then `npm run selfhosted:import-data -- --apply`
6. Dry-run then apply the existing Better Auth UUID/password importer:
   `npm run selfhosted:import-auth`
   then `npm run selfhosted:import-auth -- --apply`
7. Dry-run then apply private textbook files:
   `npm run selfhosted:import-textbooks`
   then `npm run selfhosted:import-textbooks -- --apply`
8. Reconcile every public source/target table by exact row count and a deterministic SHA-256 over canonical JSON rows:
   `npm run selfhosted:reconcile`
9. Run Better Auth cutover readiness. Only zero orphan/mismatch counts permit the one-way identity FK cutover.
10. Run the reviewed `40-better-auth-identity-cutover.sql` exactly once, then perform staging smoke tests.
11. Take a coordinated PostgreSQL + textbook backup immediately before public traffic cutover:
    `npm run selfhosted:backup`
12. Verify the backup and periodically prove a fresh restore:
    `npm run selfhosted:verify-backup -- <backup-dir>`
    `npm run selfhosted:restore-rehearsal -- <backup-dir>`

The public-data importer is destructive only when `--apply` is provided. It refuses to import while the target `auth.users` bridge is empty, verifies the dump SHA-256 first, truncates only `public` application tables, restores in a single transaction, and leaves Supabase-managed schemas out of the data dump. Auth and Storage are migrated by their dedicated paths instead.

The textbook exporter treats `public.textbook_documents` as the authoritative inventory and requires an exact match against the source `storage.objects` inventory for the configured private bucket. Every downloaded object must match both `file_size` and `content_sha256` before it can be imported into the VPS filesystem volume.
