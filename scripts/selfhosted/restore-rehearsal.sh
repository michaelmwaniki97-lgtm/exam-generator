#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

backup_dir="${1:-}"
[ -n "$backup_dir" ] || { echo "Usage: $0 <backup-directory>" >&2; exit 2; }
backup_dir=$(realpath "$backup_dir")
"$(dirname "$0")/verify-backup.sh" "$backup_dir"

original_project="$SELFHOSTED_PROJECT"
SELFHOSTED_PROJECT="${RESTORE_REHEARSAL_PROJECT:-exam-generator-restore-check-$$}"
export SELFHOSTED_PROJECT
cleanup() {
  docker compose -p "$SELFHOSTED_PROJECT" --env-file "$SELFHOSTED_ENV_FILE" -f "$SELFHOSTED_COMPOSE_FILE" down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

compose up -d --wait database
compose --profile ops run --rm schema-bootstrap >/dev/null
cat "$backup_dir/database.dump" | compose exec -T database sh -ec \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges --exit-on-error'

compose run --rm --no-deps -v "$backup_dir:/backup:ro" --entrypoint sh app -ec '
  find /data/textbooks -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
  tar -xzf /backup/textbooks.tar.gz -C /data/textbooks
'

result=$(compose exec -T database sh -ec 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -XAtqc "select count(*) from selfhosted_meta.schema_migrations; select current_setting('"'"'server_version'"'"'); select extversion from pg_extension where extname='"'"'vector'"'"';"')
printf 'restore_rehearsal=%s\n%s\n' "$SELFHOSTED_PROJECT" "$result"
echo "Restore rehearsal PASS; disposable restore project will now be removed."
SELFHOSTED_PROJECT="$original_project"
