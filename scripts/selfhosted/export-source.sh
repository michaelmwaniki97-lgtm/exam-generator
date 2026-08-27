#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

require_command docker
require_command sha256sum
require_env SOURCE_DATABASE_URL
require_env SOURCE_SUPABASE_URL
require_env SOURCE_SUPABASE_SERVICE_ROLE_KEY
prepare_private_dir "$CUTOVER_ARTIFACTS_DIR"

public_dump="$(public_dump_path)"
auth_export="$(auth_export_path)"
textbook_dir="$(textbook_export_dir)"

rm -f "$public_dump" "$public_dump.sha256" "$auth_export" "$auth_export.meta.json"
rm -rf "$textbook_dir"
mkdir -p "$textbook_dir"
chmod 700 "$textbook_dir"

# Only the public schema's data is exported. Supabase-managed auth/storage schemas
# are handled by purpose-built identity/storage exporters below.
docker run --rm \
  -e SOURCE_DATABASE_URL \
  -v "$CUTOVER_ARTIFACTS_DIR:/cutover" \
  postgres:17-bookworm \
  sh -ec 'pg_dump "$SOURCE_DATABASE_URL" --schema=public --data-only --format=custom --no-owner --no-privileges --no-subscriptions --file=/cutover/public-data.dump'

sha256sum "$public_dump" > "$public_dump.sha256"
chmod 600 "$public_dump" "$public_dump.sha256"

export CUTOVER_ARTIFACTS_DIR
compose --profile ops build ops >/dev/null
compose --profile ops run --rm \
  -e SOURCE_DATABASE_URL \
  ops node scripts/selfhosted/export-supabase-auth.mjs /cutover/auth-users.jsonl

compose --profile ops run --rm \
  -e SOURCE_DATABASE_URL \
  -e SOURCE_SUPABASE_URL \
  -e SOURCE_SUPABASE_SERVICE_ROLE_KEY \
  -e SOURCE_TEXTBOOK_BUCKET="${SOURCE_TEXTBOOK_BUCKET:-textbooks}" \
  ops node scripts/selfhosted/export-textbooks.mjs /cutover/textbooks

compose --profile ops run --rm ops node scripts/selfhosted/verify-textbook-export.mjs /cutover/textbooks

echo "Source cutover export complete: $CUTOVER_ARTIFACTS_DIR"
echo "Sensitive auth/source artifacts are intentionally outside the repository by default."
