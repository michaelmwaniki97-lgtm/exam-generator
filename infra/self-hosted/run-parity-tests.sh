#!/usr/bin/env bash
set -Eeuo pipefail

compose_file="docker-compose.selfhosted.yml"
database_service="database"

docker compose -f "$compose_file" up -d --wait "$database_service"
docker compose -f "$compose_file" exec -T "$database_service" \
  bash -lc 'psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --file /selfhosted/tests/rpc-and-security-b1.sql'
docker compose -f "$compose_file" exec -T "$database_service" \
  bash /selfhosted/tests/concurrency.sh
