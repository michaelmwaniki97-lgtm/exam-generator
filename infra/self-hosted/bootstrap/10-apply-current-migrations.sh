#!/usr/bin/env bash
set -Eeuo pipefail

for migration in /selfhosted/current-migrations/*.sql; do
  echo "Applying parity migration: $(basename "$migration")"
  psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --set ON_ERROR_STOP=1 --file "$migration"
done

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set ON_ERROR_STOP=1 <<'SQL'
select current_setting('server_version') as postgres_version;
select extname, extversion from pg_extension where extname in ('pgcrypto', 'vector') order by extname;
SQL
