#!/usr/bin/env sh
set -eu

runtime_env_file="${RUNTIME_ENV_FILE:-/run/secrets/runtime_env}"

if [ ! -r "$runtime_env_file" ]; then
  echo "Runtime secret file is missing or unreadable: $runtime_env_file" >&2
  exit 1
fi

while IFS= read -r line || [ -n "$line" ]; do
  line=$(printf '%s' "$line" | tr -d '\r')
  case "$line" in
    ''|'#'*) continue ;;
  esac
  key=${line%%=*}
  value=${line#*=}
  case "$key" in
    ''|*[!A-Za-z0-9_]*)
      echo "Invalid key in runtime secret file." >&2
      exit 1
      ;;
  esac
  export "$key=$value"
done < "$runtime_env_file"

if [ "${TEXTBOOK_STORAGE_BACKEND:-}" = "filesystem" ]; then
  root=${TEXTBOOK_STORAGE_ROOT:-/data/textbooks}
  if [ "$root" != "/data/textbooks" ]; then
    echo "Production container expects TEXTBOOK_STORAGE_ROOT=/data/textbooks." >&2
    exit 1
  fi
  mkdir -p "$root"
fi

exec "$@"
