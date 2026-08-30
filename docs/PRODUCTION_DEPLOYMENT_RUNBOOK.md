# AI Exam Generator production deployment runbook

Status: authoritative operator guide for the accepted self-hosted architecture. Completing this document still requires client-owned infrastructure, credentials, a controlled data migration, and live-provider acceptance. Nothing in this guide authorizes an unattended production cutover.

## 1. What caused the reported Supabase error

At the reported revision, the startup failure was deterministic:

1. `proxy.ts` calls `updateConfiguredAuthProxy()`.
2. `lib/auth-backend/config.ts` treated a missing `AUTH_BACKEND` as `supabase` in every environment.
3. The proxy therefore calls `lib/supabase/middleware.ts`.
4. That adapter creates a Supabase client from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Those values were absent, so the Supabase SDK stopped startup.

This was not evidence that the final self-hosted runtime needed Supabase. It meant the development process accidentally selected the legacy adapter before route rendering.

The current selector behavior fixes that ambiguity:

- development defaults missing selectors to PostgreSQL, Better Auth, and private filesystem storage;
- the Next production-build phase uses those non-secret selectors so the standalone image remains environment-agnostic;
- production requires explicit selectors and fails with a configuration error when any selector is missing;
- explicit Supabase compatibility/rollback remains available;
- missing PostgreSQL or Better Auth service configuration never falls through to Supabase.

Without a local PostgreSQL service, public development pages still render, protected routes fail closed to login, and `/api/health` returns 503 instead of contacting Supabase.

### Correct resolution for the accepted target

The final runtime must have all of the following, not only `AUTH_BACKEND`:

- `DATABASE_BACKEND=postgres`
- a server-only `DATABASE_URL` using the least-privilege `exam_app_runtime` role
- `AUTH_BACKEND=better-auth`
- the correct Auth lifecycle state for the current migration stage
- `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `PUBLIC_APP_URL`, `SMTP_URL`, and `AUTH_EMAIL_FROM`
- `TEXTBOOK_STORAGE_BACKEND=filesystem` and the persistent `/data/textbooks` mount
- one explicit AI provider and its server-only key
- `PAYMENT_PROVIDER=daraja` and the complete matching Daraja environment

Do **not** set `AUTH_CUTOVER_STATE=accepted` simply to get past startup. Accepted is a one-way operational declaration. The identity rows must be imported, the three reviewed application foreign keys must already target `better_auth.users`, the temporary bridge must be retired, and final checks must pass first.

### Legacy Supabase compatibility path

Only use this when deliberately keeping the old hosted architecture temporarily. It needs at least:

- `AUTH_BACKEND=supabase`
- `DATABASE_BACKEND=supabase`
- `AUTH_CUTOVER_STATE=compatibility`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` only in server/operator environments that actually use legacy privileged adapters

The service-role key is never public and must never use a `NEXT_PUBLIC_` name. Browser-safe Supabase values must be present during the platform build and runtime where applicable; redeploy after changing them. This compatibility path can operate the legacy deployment but does not complete the approved self-hosted migration.

## 2. Supported production architecture

The repository's production target is `docker-compose.production.yml` on a Linux VPS:

```text
Internet
   |
   v
Caddy :80/:443  ---- automatic TLS and security headers
   |
   v
Next.js :3000   ---- internal Docker service, non-root UID 10001
   |
   v
PostgreSQL 17 + pgvector ---- internal Docker network, no host port

Persistent volumes:
  postgres_data
  textbook_files
  next_cache
  caddy_data / caddy_config

Outbound only:
  SMTP, selected AI provider, Safaricom Daraja
```

Only Caddy publishes host ports. PostgreSQL and Next.js must not be exposed directly.

### Why the stock Vercel route is not the accepted target

The accepted textbook backend writes private PDFs to `/data/textbooks`. A serverless filesystem is ephemeral and cannot satisfy that persistence contract. Vercel also does not run this repository's PostgreSQL/Caddy/volume topology. A serverless deployment would require a reviewed storage-architecture change and separate operational design; adding Supabase variables alone would revert to compatibility mode, not finish self-hosting.

Use a VPS or another container host that provides durable Docker volumes, stable outbound networking, inbound ports 80/443, and operator-controlled backups.

## 3. Hard safety boundaries

- Never put a live secret in Git, a `NEXT_PUBLIC_` variable, Docker build arguments, screenshots, tickets, or chat logs.
- Never run integration tests, importers, schema bootstrap, restore tools, or cutover SQL against an unverified database target.
- Never run `docker compose down -v` against the live project. The production volumes contain the database, textbooks, and TLS state.
- Never run `infra/self-hosted/auth-cutover/40-better-auth-identity-cutover.sql` speculatively or twice.
- Never start public traffic before data, identity, storage, backup, and provider gates pass.
- Never use the PostgreSQL owner account as `DATABASE_URL`.
- Never place source Supabase service-role credentials in the application runtime secret.
- Never test Daraja production with an uncontrolled amount or AI with unbounded paid calls.
- Keep active Supabase sessions out of the migration plan; users must sign in again after Better Auth takes authority.

## 4. Remaining owner decisions and external prerequisites

These cannot be completed from source code alone:

- A production Linux VPS sized for the expected Next.js, PDF, AI-request, and PostgreSQL load.
- A deployment hostname and client-controlled DNS.
- Docker Engine and a current Compose v2 plugin on the VPS.
- A restricted operator account, SSH key policy, OS patching, host firewall, and time synchronization.
- A client-owned SMTP account with TLS, a verified sender, and tested deliverability.
- One client-owned AI provider account: NVIDIA, OpenAI, or Groq.
- A client-owned Daraja application, shortcode/till details, passkey, sandbox approval, and later production approval.
- A maintenance window and user communication for forced reauthentication.
- Backup retention, encryption, off-host storage, restore-time objective, and restore-point objective.
- Health/log alerting, disk-capacity alerts, certificate monitoring, incident ownership, and an on-call contact.
- A decision on the rollback observation window and the exact authority who may declare Auth `accepted`.
- If this is a new empty installation, a reviewed first-admin provisioning procedure. The repository currently has no dedicated first-admin bootstrap command. Do not invent an ad hoc production SQL step; add/review an operator tool or migrate an existing administrator before launch.

## 5. Repository and release preflight

Deploy a named commit, not an unreviewed working tree. Record the branch, full commit SHA, date, operator, intended hostname, and change approval.

On a clean checkout using Node.js 24:

```bash
git status --short
git rev-parse HEAD
npm ci
npm run deps:build-trusted
npm run typecheck
npm run lint
git diff --check
npm run build -- --webpack
npm run test:nonintegration
```

Run the package-defined focused suites as release evidence:

```bash
npm test
npm run test:structures
npm run test:components
npm run test:blueprint
npm run test:curriculum-selection
npm run test:assessment
npm run test:curriculum
npm run test:security
npm run test:create-exam
npm run test:textbooks
npm run test:selfhosted-readiness
npm run test:selfhosted-deployment
npm run test:selfhosted-cutover-ops
```

The PostgreSQL integration suite contains 27 files. Run it only against a freshly created disposable PostgreSQL 17 + pgvector database after confirming `DATABASE_URL` cannot resolve to production:

```bash
find lib -name '*.integration.test.ts' -print0 \
  | sort -z \
  | xargs -0 node --conditions=react-server --import tsx \
      --test --test-concurrency=1
```

Some integration tests intentionally mutate schemas and exercise the identity cutover. A missing disposable database is environment-blocked; a failure against an available disposable database is a release failure.

## 6. Production configuration files

Create untracked files on the VPS from the committed examples:

```bash
cp deploy/selfhosted.env.example deploy/selfhosted.env
cp deploy/secrets/postgres_owner_password.example deploy/secrets/postgres_owner_password
cp deploy/secrets/runtime.env.example deploy/secrets/runtime.env
chmod 600 deploy/selfhosted.env \
  deploy/secrets/postgres_owner_password \
  deploy/secrets/runtime.env
```

Restrict ownership to the deployment operator. `.gitignore` and `.dockerignore` exclude these live copies, but permissions and operator discipline remain required.

### `deploy/selfhosted.env`: non-secret values

Set and review:

- `APP_DOMAIN` — hostname only, without scheme or path
- `ACME_EMAIL`
- paths to both secret files
- `POSTGRES_DB=exam_generator`
- `POSTGRES_USER=exam_db_owner`
- `POSTGRES_HOST=database`
- `POSTGRES_PORT=5432`
- database, Auth, mutation, storage, AI, and payment mode selectors
- `PUBLIC_APP_URL` and `BETTER_AUTH_URL` — the same clean HTTPS origin
- `AUTH_EMAIL_FROM`
- model names
- Daraja environment, transaction type, and production query URL

The committed example shows the final accepted state. During a migration it must be changed to the lifecycle state described in section 11; do not declare accepted at the beginning.

### `deploy/secrets/postgres_owner_password`: owner secret

Store one long random owner password and nothing else. It must differ from the runtime password. It is consumed only by the database container and schema-bootstrap job.

### `deploy/secrets/runtime.env`: server-only runtime secrets

Set:

- `POSTGRES_RUNTIME_PASSWORD`
- `DATABASE_URL`
- `BETTER_AUTH_SECRET` with at least 32 high-entropy characters
- `SMTP_URL`
- the selected AI provider key; leave unused provider keys empty
- all Daraja credential fields

The file parser treats everything after the first `=` literally. Do not wrap values in shell quotes. Percent-encode special characters in URL usernames/passwords. The database URL must use `exam_app_runtime`, hostname `database`, port `5432`, and the configured database name. It must not use `exam_db_owner`.

Do not paste secret values into command history. Populate the files through the client's approved secret-management workflow. Review names and presence without printing values.

### Accepted runtime must not receive legacy Supabase secrets

After acceptance, omit:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The readiness report records only whether legacy values are present; it never prints them. Operator-only source migration credentials are separate and temporary.

## 7. DNS, network, and host preparation

Before Caddy requests a public certificate:

1. Point the hostname's A record, and AAAA only when IPv6 is correctly routed, to the VPS.
2. Confirm forward DNS resolves to the intended host from outside the provider network.
3. Allow SSH only from intended operator sources where practical.
4. Allow public TCP 80 and TCP/UDP 443.
5. Do not allow public 3000 or 5432.
6. Confirm the VPS clock is synchronized; TLS, Auth, and Daraja timestamps depend on it.
7. Confirm outbound DNS and HTTPS reach the selected AI provider and Safaricom, and the SMTP port reaches the mail provider.
8. Confirm adequate free disk for the live database, textbook volume, image layers, temporary PDF work, and at least one local backup before off-host transfer.

Validate the rendered topology without starting services:

```bash
docker compose \
  --env-file deploy/selfhosted.env \
  -f docker-compose.production.yml \
  config
```

The rendered configuration must publish ports only under `caddy`. It must reference secret files, not embed their contents.

Build before touching data:

```bash
docker compose \
  --env-file deploy/selfhosted.env \
  -f docker-compose.production.yml \
  build app ops
```

## 8. Bootstrap a fresh target database

Start PostgreSQL only:

```bash
docker compose \
  --env-file deploy/selfhosted.env \
  -f docker-compose.production.yml \
  up -d database
```

Inspect health without exposing the database. Then run the explicit schema job:

```bash
docker compose \
  --env-file deploy/selfhosted.env \
  -f docker-compose.production.yml \
  --profile ops run --rm schema-bootstrap
```

The job creates compatibility roles/helpers, applies `supabase/migrations/*.sql` and `infra/self-hosted/auth/*.sql`, and records SHA-256 values in `selfhosted_meta.schema_migrations`. It fails if an applied migration's contents later change.

It never applies `infra/self-hosted/auth-cutover/40-better-auth-identity-cutover.sql`.

Do not bootstrap an arbitrary restored database that did not originate from this ledgered process. A restore uses the reviewed restore path instead.

## 9. Choose exactly one data path

### Path A: migrate the existing Supabase production application

Use this when teachers, admins, curriculum data, exams, payments, or textbook files already exist. Follow sections 10 through 12. This is the expected path for replacing a live Supabase/Vercel deployment.

### Path B: launch a genuinely empty installation

There is no source export/import. After schema bootstrap:

1. Prove the 27 PostgreSQL integration tests on a separate disposable database.
2. Take a pre-cutover target backup.
3. Review the manual FK cutover with zero identities and zero application rows.
4. Apply it exactly once under the same approval and verification rules as section 11.
5. Configure `AUTH_BACKEND=better-auth`, `DATABASE_BACKEND=postgres`, `AUTH_CUTOVER_STATE=accepted`, and `AUTH_MUTATION_MODE=normal`.
6. Start the private staging application and create a teacher through the real signup flow.
7. Use a separately reviewed first-admin provisioning procedure before public launch.

An empty installation must not run the source import scripts with fabricated exports.

## 10. Existing-production export and import

### 10.1 Rehearse before the maintenance window

Perform the full sequence against a staging target and a recent source snapshot first. Record duration, storage size, import counts, reconciliation hashes, failure recovery, and estimated outage. A first-ever rehearsal is not a production cutover.

The cutover artifact directory defaults to `/tmp/exam-generator-cutover`. It contains database data, textbook PDFs, user metadata, and password hashes. Keep it mode `0700`, place it on encrypted storage where required, restrict backups, and transfer it only through an approved encrypted channel.

### 10.2 Freeze source mutations

Before the final export, block new signup and password recovery/reset and stop all application data writes through a reviewed maintenance procedure. Merely freezing Auth mutations does not freeze exams, payments, profiles, curriculum, or textbook writes. The source must be quiescent for an exact data reconciliation.

Keep the old application and database intact throughout the rollback window. Do not decommission Supabase or Vercel yet.

### 10.3 Inject temporary source credentials

The operator process needs these temporary variables:

- `SOURCE_DATABASE_URL` — a source Supabase direct or session-pooler PostgreSQL URL with required TLS
- `SOURCE_SUPABASE_URL`
- `SOURCE_SUPABASE_SERVICE_ROLE_KEY`
- optional `SOURCE_TEXTBOOK_BUCKET`, default `textbooks`
- optional `CUTOVER_ARTIFACTS_DIR`

Inject them from the approved secret manager into the restricted operator session. Do not save them in the repository, `deploy/selfhosted.env`, `deploy/secrets/runtime.env`, shell scripts, or screenshots.

### 10.4 Export one consistent source window

```bash
npm run selfhosted:export-source
```

This produces a public-schema data dump, a privileged Auth JSONL export and metadata, and a private textbook export/manifest. It verifies textbook inventory, size, and SHA-256. Any unsupported/missing password material, object mismatch, download error, or hash mismatch blocks cutover.

### 10.5 Seed the target identity bridge

Dry run, review counts, then apply:

```bash
npm run selfhosted:seed-auth-bridge
npm run selfhosted:seed-auth-bridge -- --apply
```

The bridge preserves source UUIDs in the transitional target `auth.users`. Conflicts block the import.

### 10.6 Import public application data

Dry run, review, then apply:

```bash
npm run selfhosted:import-data
npm run selfhosted:import-data -- --apply
```

The apply step intentionally truncates target `public` application tables and restores the source dump transactionally. Confirm the target project and artifact checksums immediately before authorizing it.

### 10.7 Import Better Auth identities and credentials

Dry run, review, then apply:

```bash
npm run selfhosted:import-auth
npm run selfhosted:import-auth -- --apply
```

The apply output includes pre-FK readiness counts. Every count must be zero. This is the pre-cutover identity evidence; archive the count-only output securely. Do not archive the Auth JSONL in ordinary logs.

### 10.8 Import private textbooks

Dry run, review, then apply:

```bash
npm run selfhosted:import-textbooks
npm run selfhosted:import-textbooks -- --apply
```

Apply replaces the target textbook volume contents with the verified export and rechecks every file. Confirm the target volume before authorizing it.

### 10.9 Reconcile source and target

```bash
npm run selfhosted:reconcile
```

Every public table must match by exact row count and deterministic SHA-256. Storage must match the textbook manifest. Auth pre-cutover readiness must be all zero. Any mismatch is a no-go; do not manually edit counts to proceed.

## 11. Better Auth lifecycle and one-way FK cutover

### Lifecycle states

- `compatibility`: pre-acceptance lifecycle state. Development still selects Better Auth when `AUTH_BACKEND` is missing; production must name either backend explicitly.
- `rollback-window`: requires PostgreSQL and `AUTH_MUTATION_MODE=cutover-freeze`. It may select Better Auth for target traffic while Auth mutations remain frozen.
- `accepted`: requires PostgreSQL, Better Auth, and `AUTH_MUTATION_MODE=normal`. Supabase Auth is permanently rejected by runtime guards.

For an existing migration, configure the target for the controlled observation window:

```text
DATABASE_BACKEND=postgres
AUTH_BACKEND=better-auth
AUTH_CUTOVER_STATE=rollback-window
AUTH_MUTATION_MODE=cutover-freeze
```

### Irreversible STOP gate

Before the manual SQL, require all of this evidence:

- final source writes are stopped;
- final source export completed;
- public data reconciliation is PASS for every table;
- Better Auth import apply completed and every pre-FK readiness count is zero;
- textbook manifest and target volume hashes are PASS;
- SMTP and the HTTPS origin were tested in staging;
- a coordinated pre-cutover database/textbook backup exists and verifies;
- a restore rehearsal has passed on a disposable project;
- rollback ownership and decision time are written down;
- the operator has independently confirmed the target Compose project and database;
- an authorized human has approved the one-way step.

The SQL file is transactional and rechecks identity and FK preconditions. Apply it **once** by streaming the reviewed committed file into the target database container:

```bash
docker compose \
  --env-file deploy/selfhosted.env \
  -f docker-compose.production.yml \
  exec -T database sh -ec \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -v ON_ERROR_STOP=1' \
  < infra/self-hosted/auth-cutover/40-better-auth-identity-cutover.sql
```

Do not rerun it after success. It moves exactly three foreign keys (`teachers.user_id`, `admins.user_id`, and `textbook_documents.uploaded_by`) to `better_auth.users`, drops the historical signup trigger, and revokes the temporary service-role bridge permissions.

### Post-FK traffic readiness

Run inside the operator image, which loads the mounted runtime secret without printing it:

```bash
docker compose \
  --env-file deploy/selfhosted.env \
  -f docker-compose.production.yml \
  --profile ops run --rm ops \
  node --conditions=react-server --experimental-strip-types \
  scripts/check-better-auth-cutover.ts

docker compose \
  --env-file deploy/selfhosted.env \
  -f docker-compose.production.yml \
  --profile ops run --rm ops \
  node --conditions=react-server --experimental-strip-types \
  scripts/check-better-auth-rollback-window.ts
```

Both must pass. The first check is post-FK traffic readiness despite its name; the pre-FK identity counts come from the Auth importer and the SQL's transaction guard.

## 12. Start staging traffic, observe, and accept

Start the app and Caddy only after the gates above:

```bash
docker compose \
  --env-file deploy/selfhosted.env \
  -f docker-compose.production.yml \
  up -d app caddy
```

Keep the deployment private or in a controlled maintenance window first. Existing Supabase sessions do not migrate. Test with existing migrated accounts, not synthetic production identities.

While `cutover-freeze` is active, sign-in, session resolution, and sign-out work. Signup, recovery/reset, and other credential mutations intentionally return temporary-unavailable. Test recovery beforehand in staging and again after final acceptance.

After the written observation window passes and the authorized owner gives up configuration-only Supabase Auth rollback, change together:

```text
AUTH_CUTOVER_STATE=accepted
AUTH_MUTATION_MODE=normal
```

Keep `AUTH_BACKEND=better-auth` and `DATABASE_BACKEND=postgres`. Recreate the app container so it reads the new environment:

```bash
docker compose \
  --env-file deploy/selfhosted.env \
  -f docker-compose.production.yml \
  up -d --force-recreate app
```

Then run final acceptance:

```bash
docker compose \
  --env-file deploy/selfhosted.env \
  -f docker-compose.production.yml \
  --profile ops run --rm ops \
  node --conditions=react-server --experimental-strip-types \
  scripts/check-better-auth-finalization.ts
```

Once accepted traffic creates identities or changes credentials, switching `AUTH_BACKEND` back to Supabase is not a valid rollback. A new credential/identity reconciliation project would be required.

## 13. Self-hosted readiness gate

After accepted configuration, run the source/runtime dependency gate. The operator image does not mount the textbook volume by default, so mount the existing named volume read-only for this check:

```bash
docker compose \
  --env-file deploy/selfhosted.env \
  -f docker-compose.production.yml \
  --profile ops run --rm \
  --volume exam-generator-selfhosted_textbook_files:/data/textbooks:ro \
  ops npm run selfhosted:check
```

Before using that command, confirm the actual volume name with `docker volume inspect`; do not create a similarly named empty volume by typo. The report must show accepted PostgreSQL/Better Auth/filesystem/Daraja settings and zero direct application Supabase dependencies. Retained guarded fallback adapters and maintenance scripts are reported separately and are not accepted-runtime traffic.

## 14. Health, security, and functional smoke tests

### Infrastructure

- `https://<domain>/api/health` returns HTTP 200 with `{"status":"ok"}`.
- A database outage produces 503 with `{"status":"unavailable"}` and no internal error.
- HTTP redirects to HTTPS.
- The response includes HSTS, `X-Content-Type-Options: nosniff`, the reviewed referrer policy, and `X-Frame-Options: DENY`.
- Only 80/443 are reachable publicly; 3000/5432 are not.
- Caddy certificate issuance and renewal state are healthy.
- App and database containers run healthy; the app process is non-root.
- Textbook files survive an app-container replacement.

### Public/Auth

- Homepage and login render at 375, 768, 1024, and 1440 CSS pixels.
- Protected teacher/admin URLs redirect unauthenticated users to login.
- Migrated teacher sign-in works with the existing password.
- First successful imported bcrypt login upgrades safely; a later login still works.
- Logout invalidates the database-backed session.
- Signup creates a Better Auth user and teacher profile only after accepted mode.
- Recovery email arrives, uses the production HTTPS origin, expires correctly, and reset works.
- Old Supabase Auth callback returns retired behavior after acceptance.

### Teacher

- Dashboard and profile load only the signed-in teacher's data.
- Create-exam wizard loads curriculum, grades, subjects, textbooks, terms, topics, marks, duration, and difficulty.
- AI generation completes once with a controlled quota and returns a marking scheme.
- Preview, editor, and individual-question regeneration preserve ownership.
- Previous exams and transaction history load.
- Unpaid PDF download is denied.
- Daraja sandbox initiation, callback, query reconciliation, payment entitlement, and paid PDF download pass.
- Generated exam and marking-scheme PDFs render with expected fonts and page layout.

### Admin

- A real migrated/provisioned admin reaches the admin dashboard.
- A teacher cannot reach admin routes or mutations.
- Teachers, subjects, grades, curriculum, textbooks, and settings pages load.
- One reversible staging create/update/delete workflow passes for each relevant admin area.
- Textbook PDF validation, private storage, ingestion, retrieval, and deletion are verified without exposing the volume through Caddy.

### Daraja production handover

The callback URL is derived as:

```text
https://<domain>/api/payments/mpesa/callback
```

Complete Safaricom's current production approval. Verify the production query URL with Safaricom and set `MPESA_QUERY_URL` only to the approved HTTPS `api.safaricom.co.ke` endpoint. Keep `MPESA_ENVIRONMENT=sandbox` until the full sandbox flow passes. Then install the separate production credentials, select production explicitly, and perform one controlled low-value live payment with written approval.

### AI and SMTP handover

- Verify provider account ownership, model availability, quota, rate limits, billing alerts, timeout behavior, and safe log redaction.
- Make one bounded production AI request only after approval.
- Verify SMTP SPF/DKIM/DMARC and sender alignment outside the codebase.
- Test inbox delivery and recovery links with non-sensitive acceptance accounts.

## 15. Backup and restore

Take a coordinated backup:

```bash
npm run selfhosted:backup
```

Verify its checksums and archive readability:

```bash
npm run selfhosted:verify-backup -- <backup-directory>
```

Prove restoration into a unique disposable Compose project:

```bash
RESTORE_REHEARSAL_PROJECT=<unique-disposable-name> \
  npm run selfhosted:restore-rehearsal -- <backup-directory>
```

The rehearsal script deletes only its disposable project and volumes during cleanup. Independently verify the project name cannot equal the live project before running it. Never substitute the live project name and never manually use `down -v` on production.

The built-in backup is local and unencrypted. Production still needs:

- encryption at rest and in transit;
- an off-host copy in a separate failure domain;
- restricted access and audit logs;
- retention and secure-expiry policy;
- automated success/failure alerts;
- regular restore rehearsals;
- documented recovery timing and ownership.

Keep a backup immediately before the one-way FK cutover, immediately before public traffic, and after final acceptance.

## 16. Monitoring and routine operations

At minimum monitor:

- external HTTPS health and latency;
- app/database/Caddy container health and restart loops;
- PostgreSQL connection saturation, slow queries, locks, database size, and volume free space;
- textbook volume size and file/hash failures;
- Caddy certificate renewal;
- HTTP 5xx and protected-route redirect anomalies;
- Auth sign-in/recovery failures without logging credentials or tokens;
- Daraja OAuth, STK, callback, query, and persistence classifications;
- AI provider errors, latency, quota, and spend;
- SMTP delivery/bounce rate;
- backup age, off-host copy age, and restore-rehearsal age.

Define log retention and access. Do not paste raw production logs into public issues; even redacted application errors can contain operational metadata.

Schedule OS and container-image patch review. Image upgrades require the same staging build, tests, backup, and rollback discipline as application releases.

## 17. Rollback rules

There are three different rollback scopes; do not confuse them.

### Before manual FK cutover

No target traffic should exist. Stop, preserve artifacts/logs, correct the issue, rebuild the fresh target if necessary, and repeat rehearsal. The source remains authoritative.

### Auth rollback window after FK cutover

`AUTH_CUTOVER_STATE=rollback-window` plus `AUTH_MUTATION_MODE=cutover-freeze` preserves the reviewed Auth rollback window. Supabase can be the Auth selector only if the required guarded legacy credentials and topology were deliberately retained and tested. Users may need to reauthenticate.

This is not automatically a full application-data rollback. If target users create exams, payments, profiles, or textbook changes, routing back to the old application creates data divergence. Keep public writes blocked until the full-stack rollback/reconciliation plan is proven, or define how those writes will be transferred safely.

### After accepted

Environment-only Supabase Auth rollback is over. Restore the new stack from its validated backups for infrastructure failures. Any return to the legacy stack requires a separately designed data and credential reconciliation; do not improvise it during an incident.

Never delete the old source or revoke its final recovery access until the acceptance owner signs the decommission record and required retention/rollback periods have elapsed.

## 18. Troubleshooting

### “Your project's URL and Key are required”

The runtime selected Supabase. Inspect only variable names/presence, never values. For the final target, provide the complete self-hosted configuration and correct lifecycle state. For deliberate compatibility mode, provide the repository's two expected public Supabase variables and redeploy.

### `/api/health` returns 503

Check database container health, internal DNS name `database`, the runtime role, URL encoding, database name, secret-file readability, migration state, and app logs. The endpoint intentionally does not reveal the database error.

### App container is unhealthy

Confirm runtime secret parsing, `TEXTBOOK_STORAGE_ROOT=/data/textbooks`, volume permissions for UID/GID 10001, database health, and a successful standalone build. Production runs `node server.js`; do not replace it with `next start` inside the standalone image.

### Better Auth configuration fails

Confirm matching clean HTTPS origins, 32+ character secret, TLS SMTP URL, selected PostgreSQL backend, correct lifecycle pair, successful identity import, and the three reviewed post-cutover foreign keys.

### Caddy cannot issue a certificate

Check A/AAAA records, ports 80/443, provider firewall, another process binding the ports, system time, and Caddy logs. Do not disable TLS verification as a workaround.

### Textbook upload/read fails

Confirm the named volume is mounted at `/data/textbooks`, the non-root app user can access it, Caddy does not serve it directly, the file is a validated PDF within the 12 MiB application limit, and stored path/hash metadata matches.

### Daraja callback does not settle payment

Confirm the public HTTPS callback is reachable, environment/credentials/shortcode/passkey/transaction type match, amount and phone match the server-created attempt, request IDs match, and the verified query endpoint is configured in production. Never mark a payment paid manually to bypass verification.

## 19. Final go/no-go record

All items below must be evidenced, not assumed:

- [ ] Approved commit and clean release checkout recorded.
- [ ] Typecheck, lint, diff check, webpack production build, and all non-integration tests pass.
- [ ] All 27 PostgreSQL integration files pass against a disposable pgvector target.
- [ ] Docker Compose config and app/ops builds pass on the deployment host.
- [ ] DNS, TLS, firewall, time, disk, and outbound provider connectivity pass.
- [ ] Secret files are untracked, mode `0600`, correctly owned, and backed by an approved secret process.
- [ ] PostgreSQL uses the runtime role; 3000/5432 are not public.
- [ ] Source freeze and final export are complete, if migrating.
- [ ] Public tables reconcile by count and SHA-256.
- [ ] Auth pre-FK readiness counts are all zero.
- [ ] Textbook inventory, size, and SHA-256 reconcile.
- [ ] Pre-cutover backup verifies and a disposable restore rehearsal passes.
- [ ] Manual identity FK cutover was authorized, applied once, and recorded.
- [ ] Post-FK traffic and rollback-window checks pass.
- [ ] Teacher/admin isolation, Auth, exam, editor, PDF, payment, storage, and responsive smoke tests pass.
- [ ] Daraja sandbox and SMTP recovery pass.
- [ ] Rollback observation window and data-divergence plan are approved.
- [ ] Final accepted configuration and finalization check pass.
- [ ] Self-hosted dependency/readiness check passes with no legacy Supabase runtime secrets.
- [ ] Post-acceptance backup, off-host copy, alerts, and restore schedule are active.
- [ ] Client approves one controlled Daraja production payment and bounded AI call.
- [ ] First administrator is verified; no user can self-promote.
- [ ] User reauthentication/maintenance communication is complete.
- [ ] Decommissioning of Supabase/Vercel is deferred until explicit post-acceptance approval.

Any unchecked identity, reconciliation, backup/restore, payment, or authorization item is a no-go for production traffic.

## 20. Known work that remains environment-blocked until supplied

Source code can validate contracts, but final acceptance still needs:

- a disposable PostgreSQL 17 + pgvector environment for 27 integration files;
- Docker/Compose on the target host for image and topology validation;
- the real source database and temporary source Supabase operator credentials for export/reconciliation;
- production DNS and a reachable VPS for Caddy/TLS;
- client-owned SMTP credentials and sender-domain configuration;
- client-owned AI credentials/quota;
- Daraja sandbox and production credentials/approval;
- real migrated teacher/admin accounts for role and ownership smoke tests;
- production-scale data/storage timing and disk-capacity evidence;
- an off-host encrypted backup destination and alerting platform;
- a reviewed first-admin bootstrap tool if no admin is being migrated;
- a client-approved maintenance, rollback, acceptance, and decommission decision.

Do not call the system finally deployed until those external gates are completed and the go/no-go record is signed.
