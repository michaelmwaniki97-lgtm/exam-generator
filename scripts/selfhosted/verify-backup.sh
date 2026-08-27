#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

backup_dir="${1:-}"
[ -n "$backup_dir" ] || { echo "Usage: $0 <backup-directory>" >&2; exit 2; }
backup_dir=$(realpath "$backup_dir")
require_file "$backup_dir/database.dump"
require_file "$backup_dir/textbooks.tar.gz"
require_file "$backup_dir/SHA256SUMS"

(cd "$backup_dir" && sha256sum -c SHA256SUMS)
docker run --rm -v "$backup_dir:/backup:ro" pgvector/pgvector:0.8.6-pg17-bookworm pg_restore -l /backup/database.dump >/dev/null
docker run --rm -v "$backup_dir:/backup:ro" alpine:3.22 tar -tzf /backup/textbooks.tar.gz >/dev/null
echo "Backup artifacts and checksums are readable."
