import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = async (file: string) => (await readFile(path.join(root, file), "utf8")).replace(/\r\n?/g, "\n");

test("production image uses Next standalone output, exact Node line, and a non-root runtime", async () => {
  const [dockerfile, nextConfig, npmrc, packageSource, lockSource] = await Promise.all([
    read("Dockerfile.selfhosted"),
    read("next.config.ts"),
    read(".npmrc"),
    read("package.json"),
    read("package-lock.json"),
  ]);
  const packageJson = JSON.parse(packageSource) as { scripts?: Record<string, string>; allowScripts?: unknown };
  const packageLock = JSON.parse(lockSource) as { packages?: Record<string, { hasInstallScript?: boolean }> };
  const lifecyclePackages = Object.entries(packageLock.packages ?? {})
    .filter(([, metadata]) => metadata.hasInstallScript)
    .map(([name]) => name)
    .sort();
  assert.match(nextConfig, /output:\s*["']standalone["']/);
  assert.match(nextConfig, /node_modules\/pdfjs-dist\/\*\*\/\*/);
  assert.match(dockerfile, /FROM node:24\.19\.0-bookworm-slim AS base/);
  assert.match(dockerfile, /FROM base AS deps/);
  assert.match(dockerfile, /FROM node:24\.19\.0-bookworm-slim AS runner/);
  assert.match(dockerfile, /COPY package\.json package-lock\.json \.npmrc \.\//);
  assert.match(dockerfile, /RUN npm ci && npm run deps:build-trusted/);
  assert.match(npmrc, /^ignore-scripts=true$/m);
  assert.doesNotMatch(npmrc, /strict-allow-scripts|allow-scripts|ignore-scripts=false/);
  assert.equal(packageJson.allowScripts, undefined);
  assert.equal(
    packageJson.scripts?.["deps:build-trusted"],
    "npm rebuild bcrypt@6.0.0 esbuild@0.28.2 unrs-resolver@1.12.2 --ignore-scripts=false",
  );
  assert.deepEqual(lifecyclePackages, [
    "node_modules/bcrypt",
    "node_modules/esbuild",
    "node_modules/fsevents",
    "node_modules/unrs-resolver",
  ]);
  assert.match(dockerfile, /npx next build --webpack/);
  assert.match(dockerfile, /\.next\/standalone/);
  assert.match(dockerfile, /USER 10001:10001/);
  assert.doesNotMatch(dockerfile, /NEXT_PUBLIC_SUPABASE|SUPABASE_SERVICE_ROLE|BETTER_AUTH_SECRET=/);
});

test("production compose exposes only Caddy while database remains private and persistent", async () => {
  const compose = await read("docker-compose.production.yml");
  const databaseBlock = compose.match(/\n  database:\n([\s\S]*?)\n  schema-bootstrap:/)?.[1] ?? "";
  const appBlock = compose.match(/\n  app:\n([\s\S]*?)\n  caddy:/)?.[1] ?? "";
  const caddyBlock = compose.match(/\n  caddy:\n([\s\S]*?)\nsecrets:/)?.[1] ?? "";
  assert.doesNotMatch(databaseBlock, /\n\s+ports:/);
  assert.doesNotMatch(appBlock, /\n\s+ports:/);
  assert.match(appBlock, /expose:\n\s+- "3000"/);
  assert.match(caddyBlock, /- "80:80"/);
  assert.match(caddyBlock, /- "443:443"/);
  assert.match(caddyBlock, /- "443:443\/udp"/);
  assert.match(compose, /backend:\n\s+internal: true/);
  for (const volume of ["postgres_data", "textbook_files", "next_cache", "caddy_data", "caddy_config"]) {
    assert.match(compose, new RegExp(`\\n  ${volume}:`), volume);
  }
  assert.match(databaseBlock, /pgvector\/pgvector:0\.8\.6-pg17-bookworm/);
  assert.match(caddyBlock, /caddy:2\.11\.4-alpine/);
});

test("schema migration is an explicit one-off job with checksum ledger and no parity password", async () => {
  const [compose, bootstrap, compatibility, parity] = await Promise.all([
    read("docker-compose.production.yml"),
    read("infra/self-hosted/deploy/bootstrap-schema.sh"),
    read("infra/self-hosted/deploy/00-production-compatibility.sql"),
    read("infra/self-hosted/bootstrap/00-supabase-compatibility.sql"),
  ]);
  assert.match(compose, /schema-bootstrap:[\s\S]*profiles: \["ops"\]/);
  assert.match(compose, /schema-bootstrap:[\s\S]*restart: "no"/);
  assert.doesNotMatch(compose, /docker-entrypoint-initdb\.d/);
  assert.match(bootstrap, /selfhosted_meta\.schema_migrations/);
  assert.match(bootstrap, /sha256sum/);
  assert.match(bootstrap, /--single-transaction/);
  assert.match(compatibility, /\\getenv runtime_password POSTGRES_RUNTIME_PASSWORD/);
  assert.match(compatibility, /alter role exam_app_runtime password :'runtime_password'/);
  assert.doesNotMatch(compatibility, /local-parity-runtime-only/);
  assert.match(parity, /local-parity-runtime-only/);
});

test("runtime secrets are mounted from files and real deployment copies are ignored", async () => {
  const [compose, entrypoint, gitignore, dockerignore, envExample, runtimeExample] = await Promise.all([
    read("docker-compose.production.yml"), read("infra/self-hosted/runtime/entrypoint.sh"), read(".gitignore"), read(".dockerignore"),
    read("deploy/selfhosted.env.example"), read("deploy/secrets/runtime.env.example"),
  ]);
  assert.match(compose, /file: \$\{POSTGRES_OWNER_PASSWORD_FILE\}/);
  assert.match(compose, /file: \$\{RUNTIME_ENV_FILE\}/);
  assert.match(entrypoint, /\/run\/secrets\/runtime_env/);
  assert.match(entrypoint, /export "\$key=\$value"/);
  assert.match(gitignore, /deploy\/selfhosted\.env/);
  assert.match(gitignore, /deploy\/secrets\/\*/);
  assert.match(dockerignore, /deploy\/secrets\/\*/);
  assert.match(envExample, /POSTGRES_OWNER_PASSWORD_FILE=\.\/deploy\/secrets\/postgres_owner_password/);
  assert.match(envExample, /RUNTIME_ENV_FILE=\.\/deploy\/secrets\/runtime\.env/);
  assert.match(runtimeExample, /^DATABASE_URL=/m);
  assert.match(runtimeExample, /^BETTER_AUTH_SECRET=/m);
  assert.match(runtimeExample, /^SMTP_URL=/m);
});

test("Caddy is the only public edge and protects the Next request boundary", async () => {
  const caddy = await read("deploy/Caddyfile");
  assert.match(caddy, /^\{[\s\S]*email \{\$ACME_EMAIL\}/);
  assert.match(caddy, /\{\$APP_DOMAIN\} \{/);
  assert.match(caddy, /request_body \{\s*max_size 14MB\s*\}/);
  assert.match(caddy, /reverse_proxy app:3000/);
  assert.match(caddy, /health_uri \/api\/health/);
  assert.match(caddy, /X-Content-Type-Options "nosniff"/);
  assert.match(caddy, /Strict-Transport-Security "max-age=31536000"/);
  assert.doesNotMatch(caddy, /includeSubDomains|preload/);
  assert.doesNotMatch(caddy, /tls_insecure_skip_verify/);
});

test("health endpoint is data-minimal and checks PostgreSQL on the self-hosted path", async () => {
  const health = await read("app/api/health/route.ts");
  assert.match(health, /runtime = "nodejs"/);
  assert.match(health, /getDatabaseBackendName\(\) === "postgres"/);
  assert.match(health, /getPostgresPool\(\)\.query\("select 1"\)/);
  assert.match(health, /status: "ok"/);
  assert.match(health, /status: "unavailable"/);
  assert.doesNotMatch(health, /error\.message|DATABASE_URL|BETTER_AUTH_SECRET|user/i);
});
