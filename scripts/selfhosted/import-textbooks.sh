#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/common.sh"

apply=false
if [ "${1:-}" = "--apply" ]; then apply=true; elif [ -n "${1:-}" ]; then echo "Usage: $0 [--apply]" >&2; exit 2; fi

root="$(textbook_export_dir)"
require_file "$root/manifest.json"
export CUTOVER_ARTIFACTS_DIR
compose --profile ops build ops >/dev/null
compose --profile ops run --rm ops node scripts/selfhosted/verify-textbook-export.mjs /cutover/textbooks

if [ "$apply" != true ]; then
  echo "DRY RUN: textbook export manifest and SHA-256 checks pass. Re-run with --apply to copy into the private filesystem volume."
  exit 0
fi

compose run --rm --no-deps \
  -v "$root:/import:ro" \
  --entrypoint sh app -ec '
    find /data/textbooks -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
    cp -a /import/. /data/textbooks/
    rm -f /data/textbooks/manifest.json
  '

# Verify what landed in the private volume against the source manifest without exposing files publicly.
compose run --rm --no-deps \
  -v "$root/manifest.json:/verify/manifest.json:ro" \
  --entrypoint node app -e '
    const fs=require("fs"),crypto=require("crypto"),path=require("path");
    const m=JSON.parse(fs.readFileSync("/verify/manifest.json","utf8"));
    for(const f of m.files){const p=path.resolve("/data/textbooks",f.storage_path);const root=path.resolve("/data/textbooks")+path.sep;if(!p.startsWith(root))throw Error("unsafe manifest path");const b=fs.readFileSync(p);if(b.length!==f.file_size)throw Error("size mismatch");if(crypto.createHash("sha256").update(b).digest("hex")!==f.content_sha256)throw Error("hash mismatch");}
    console.log(`verified=${m.files.length}`);
  '

echo "Private textbook filesystem import complete."
