#!/usr/bin/env bash
set -euo pipefail

SELFHOSTED_COMPOSE_FILE="${SELFHOSTED_COMPOSE_FILE:-docker-compose.production.yml}"
SELFHOSTED_ENV_FILE="${SELFHOSTED_ENV_FILE:-deploy/selfhosted.env}"
SELFHOSTED_PROJECT="${SELFHOSTED_PROJECT:-exam-generator-selfhosted}"
CUTOVER_ARTIFACTS_DIR="${CUTOVER_ARTIFACTS_DIR:-/tmp/exam-generator-cutover}"

compose() {
  docker compose -p "$SELFHOSTED_PROJECT" --env-file "$SELFHOSTED_ENV_FILE" -f "$SELFHOSTED_COMPOSE_FILE" "$@"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || { echo "Required command not found: $1" >&2; exit 2; }
}

require_file() {
  [ -f "$1" ] || { echo "Required file not found: $1" >&2; exit 2; }
}

require_env() {
  local name="$1"
  [ -n "${!name:-}" ] || { echo "$name is required." >&2; exit 2; }
}

prepare_private_dir() {
  mkdir -p "$1"
  chmod 700 "$1"
}

public_dump_path() { printf '%s/public-data.dump' "$CUTOVER_ARTIFACTS_DIR"; }
auth_export_path() { printf '%s/auth-users.jsonl' "$CUTOVER_ARTIFACTS_DIR"; }
textbook_export_dir() { printf '%s/textbooks' "$CUTOVER_ARTIFACTS_DIR"; }
