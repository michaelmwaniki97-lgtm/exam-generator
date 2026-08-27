#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

apply=false
if [ "${1:-}" = "--apply" ]; then apply=true; elif [ -n "${1:-}" ]; then echo "Usage: $0 [--apply]" >&2; exit 2; fi

require_file "$(public_dump_path)"
require_file "$(public_dump_path).sha256"
(cd "$CUTOVER_ARTIFACTS_DIR" && sha256sum -c "$(basename "$(public_dump_path).sha256")")

bridge_count=$(compose exec -T database sh -ec 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -XAtqc "select count(*) from auth.users"')
if ! [[ "$bridge_count" =~ ^[0-9]+$ ]] || [ "$bridge_count" -eq 0 ]; then
  echo "Target auth.users bridge is empty. Seed preserved identities before importing public data." >&2
  exit 3
fi

if [ "$apply" != true ]; then
  echo "DRY RUN: public data dump is valid and target auth bridge has $bridge_count identities."
  echo "Re-run with --apply to truncate public application tables and restore source public data transactionally."
  exit 0
fi

compose exec -T database sh -ec 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -v ON_ERROR_STOP=1' <<'SQL'
DO $block$
DECLARE
  target_tables text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ' ORDER BY tablename)
    INTO target_tables
  FROM pg_tables
  WHERE schemaname = 'public';
  IF target_tables IS NULL THEN
    RAISE EXCEPTION 'No public application tables found.';
  END IF;
  EXECUTE 'TRUNCATE TABLE ' || target_tables || ' CASCADE';
END
$block$;
SQL

cat "$(public_dump_path)" | compose exec -T database sh -ec \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --data-only --no-owner --no-privileges --single-transaction --exit-on-error'

compose exec -T database sh -ec 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -v ON_ERROR_STOP=1 -c "ANALYZE;"' >/dev/null

echo "Public application data import complete. Run reconciliation before any cutover."
