#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

require_command sha256sum
prepare_private_dir "$CUTOVER_ARTIFACTS_DIR"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_dir="$CUTOVER_ARTIFACTS_DIR/backups/$stamp"
prepare_private_dir "$backup_dir"

compose exec -T database sh -ec 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup_dir/database.dump"
compose run --rm --no-deps --entrypoint sh app -ec 'tar -C /data/textbooks -czf - .' > "$backup_dir/textbooks.tar.gz"

(
  cd "$backup_dir"
  sha256sum database.dump textbooks.tar.gz > SHA256SUMS
)
chmod 600 "$backup_dir/database.dump" "$backup_dir/textbooks.tar.gz" "$backup_dir/SHA256SUMS"
printf '%s\n' "$backup_dir"
