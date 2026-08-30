# AI Exam Generator

AI Exam Generator is a Next.js 16 application for Kenyan teachers to build, edit, pay for, and download curriculum-based exams. The accepted production target is a self-hosted Docker/VPS stack using PostgreSQL, Better Auth, private filesystem textbook storage, Daraja, and Caddy-managed HTTPS.

## Start here

- **Production deployment and migration:** [`docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md`](docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md)
- Self-hosted architecture and adapter history: [`docs/SELF_HOSTED_DATABASE_ABSTRACTION.md`](docs/SELF_HOSTED_DATABASE_ABSTRACTION.md)
- Production Docker/Caddy stack details: [`docs/SELF_HOSTED_VPS_STACK.md`](docs/SELF_HOSTED_VPS_STACK.md)
- Deployment-readiness contract: [`docs/SELF_HOSTED_DEPLOYMENT_READINESS.md`](docs/SELF_HOSTED_DEPLOYMENT_READINESS.md)
- Payment handover: [`lib/payments/README.md`](lib/payments/README.md)

Do not deploy from the old generic Vercel instructions. This repository's accepted storage backend needs a persistent private filesystem volume, and its production topology is defined by `docker-compose.production.yml`.

## The common Supabase URL/key startup error

If an older checkout fails in `lib/supabase/middleware.ts` with “Your project's URL and Key are required,” it omitted `AUTH_BACKEND` and fell through to the historical Supabase default. Current development defaults to Better Auth; the legacy path now requires an explicit selector.

For the accepted self-hosted target, do **not** add Supabase keys as a shortcut. Configure the complete PostgreSQL/Better Auth/filesystem runtime and complete the identity cutover gates in the production runbook. Do not set `AUTH_CUTOVER_STATE=accepted` until the reviewed identity foreign-key cutover has actually completed.

Current selection behavior is deliberate:

- `next dev` defaults missing selectors to PostgreSQL, Better Auth, and an ignored private filesystem directory under `.next`.
- `next build` uses the same non-secret selectors during prerendering so one standalone image can receive its real configuration at runtime.
- Public pages can start without Supabase credentials. Database-backed Auth and application flows still require a disposable/local `DATABASE_URL` and the remaining Better Auth settings.
- Production requires explicit database, Auth, and storage selectors and fails closed when they are absent.
- An approved compatibility/rollback deployment can still select Supabase explicitly.

## Local quality gate

Use Node.js 24 and the locked dependencies:

```bash
npm ci
npm run deps:build-trusted
npm run typecheck
npm run lint
npm run build -- --webpack
npm run test:nonintegration
```

`.npmrc` disables dependency lifecycle scripts. `deps:build-trusted` rebuilds only the repository-reviewed native/build dependencies.

Use Windows Node/npm for a checkout on `C:\`. Do not run WSL Node against Windows-installed `node_modules`; native packages such as Lightning CSS are platform-specific. If the execution platform changes, remove and reinstall dependencies on that platform rather than sharing the dependency directory.

PostgreSQL integration tests require a disposable PostgreSQL 17 + pgvector database. Never point them at production.
