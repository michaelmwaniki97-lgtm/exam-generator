#!/usr/bin/env bash
set -Eeuo pipefail

runtime_env_file="${RUNTIME_ENV_FILE:-/run/secrets/runtime_env}"
owner_password_file="${POSTGRES_OWNER_PASSWORD_FILE:-/run/secrets/postgres_owner_password}"

[[ -r "$runtime_env_file" ]] || { echo "Missing runtime secret file: $runtime_env_file" >&2; exit 1; }
[[ -r "$owner_password_file" ]] || { echo "Missing PostgreSQL owner password file: $owner_password_file" >&2; exit 1; }

while IFS= read -r line || [[ -n "$line" ]]; do
  line=${line%$'\r'}
  [[ -z "$line" || "$line" == \#* ]] && continue
  key=${line%%=*}
  value=${line#*=}
  [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || { echo "Invalid key in runtime secret file." >&2; exit 1; }
  export "$key=$value"
done < "$runtime_env_file"

: "${POSTGRES_RUNTIME_PASSWORD:?POSTGRES_RUNTIME_PASSWORD must be present in the runtime secret file}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_HOST:=database}"
: "${POSTGRES_PORT:=5432}"

export PGPASSWORD
PGPASSWORD=$(tr -d '\r\n' < "$owner_password_file")
[[ -n "$PGPASSWORD" ]] || { echo "PostgreSQL owner password file is empty." >&2; exit 1; }

psql_base=(psql --host "$POSTGRES_HOST" --port "$POSTGRES_PORT" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1)

"${psql_base[@]}" --file /selfhosted/deploy/00-production-compatibility.sql

"${psql_base[@]}" <<'SQL'
create schema if not exists selfhosted_meta;
create table if not exists selfhosted_meta.schema_migrations (
  name text primary key,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz not null default now()
);
revoke all on schema selfhosted_meta from public, anon, authenticated, service_role;
revoke all on all tables in schema selfhosted_meta from public, anon, authenticated, service_role;
SQL

apply_migration() {
  local file=$1
  local name sha recorded
  name=$(basename "$file")
  sha=$(sha256sum "$file" | awk '{print $1}')
  recorded=$("${psql_base[@]}" -Atc "select sha256 from selfhosted_meta.schema_migrations where name = '$name'" 2>/dev/null || true)

  if [[ -n "$recorded" ]]; then
    [[ "$recorded" == "$sha" ]] || { echo "Migration checksum changed after application: $name" >&2; exit 1; }
    echo "Skipping already-applied migration: $name"
    return
  fi

  echo "Applying production migration: $name"
  {
    printf "\\i '%s'\n" "$file"
    printf "insert into selfhosted_meta.schema_migrations(name, sha256) values ('%s', '%s');\n" "$name" "$sha"
  } | "${psql_base[@]}" --single-transaction
}

shopt -s nullglob
for migration in /selfhosted/current-migrations/*.sql; do apply_migration "$migration"; done
for migration in /selfhosted/auth/*.sql; do apply_migration "$migration"; done

"${psql_base[@]}" -Atqc "select 'schema_migrations=' || count(*) from selfhosted_meta.schema_migrations; select 'postgres=' || current_setting('server_version'); select 'vector=' || extversion from pg_extension where extname = 'vector';"
