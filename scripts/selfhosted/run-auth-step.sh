#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

step="${1:-}"
mode="${2:-}"
case "$step" in
  bridge|better-auth) ;;
  *) echo "Usage: $0 bridge|better-auth [--apply]" >&2; exit 2 ;;
esac
case "$mode" in
  ""|--apply) ;;
  *) echo "Usage: $0 bridge|better-auth [--apply]" >&2; exit 2 ;;
esac

require_file "$(auth_export_path)"
export CUTOVER_ARTIFACTS_DIR
compose --profile ops build ops >/dev/null

if [ "$step" = "bridge" ]; then
  command=(node --conditions=react-server --experimental-strip-types scripts/selfhosted/seed-auth-bridge.ts /cutover/auth-users.jsonl)
else
  command=(node --conditions=react-server --experimental-strip-types scripts/import-supabase-auth-export.ts /cutover/auth-users.jsonl)
fi
if [ "$mode" = "--apply" ]; then command+=(--apply); fi

compose --profile ops run --rm ops "${command[@]}"
