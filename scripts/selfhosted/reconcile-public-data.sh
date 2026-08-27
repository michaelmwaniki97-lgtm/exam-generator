#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

require_command docker
require_command sha256sum
require_env SOURCE_DATABASE_URL
prepare_private_dir "$CUTOVER_ARTIFACTS_DIR"
report="$CUTOVER_ARTIFACTS_DIR/public-reconciliation.tsv"

source_query() {
  local sql="$1"
  docker run --rm -e SOURCE_DATABASE_URL -e SQL="$sql" postgres:17-bookworm \
    sh -ec 'psql "$SOURCE_DATABASE_URL" -XqAt -v ON_ERROR_STOP=1 -c "$SQL"'
}

target_query() {
  local sql="$1"
  compose exec -T -e SQL="$sql" database sh -ec \
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -XqAt -v ON_ERROR_STOP=1 -c "$SQL"'
}

mapfile -t source_tables < <(source_query "select tablename from pg_tables where schemaname='public' order by tablename")
mapfile -t target_tables < <(target_query "select tablename from pg_tables where schemaname='public' order by tablename")

if [ "${source_tables[*]}" != "${target_tables[*]}" ]; then
  echo "Source/target public table sets differ; reconciliation blocked." >&2
  printf 'source: %s\n' "${source_tables[*]}" >&2
  printf 'target: %s\n' "${target_tables[*]}" >&2
  exit 4
fi

printf 'table\tsource_count\ttarget_count\tsource_sha256\ttarget_sha256\tstatus\n' > "$report"
failures=0
for table in "${source_tables[@]}"; do
  [[ "$table" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || { echo "Unsafe table name from catalog." >&2; exit 4; }
  count_sql="select count(*) from public.\"$table\""
  copy_sql="copy (select to_jsonb(t)::text from public.\"$table\" t order by to_jsonb(t)::text) to stdout"
  source_count=$(source_query "$count_sql")
  target_count=$(target_query "$count_sql")
  source_hash=$(source_query "$copy_sql" | sha256sum | awk '{print $1}')
  target_hash=$(target_query "$copy_sql" | sha256sum | awk '{print $1}')
  status=PASS
  if [ "$source_count" != "$target_count" ] || [ "$source_hash" != "$target_hash" ]; then status=FAIL; failures=$((failures + 1)); fi
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$table" "$source_count" "$target_count" "$source_hash" "$target_hash" "$status" | tee -a "$report"
done
chmod 600 "$report"

if [ "$failures" -ne 0 ]; then
  echo "$failures public table(s) failed reconciliation." >&2
  exit 5
fi

echo "All ${#source_tables[@]} public tables reconcile exactly. Report: $report"
