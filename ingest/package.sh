#!/usr/bin/env bash
# Builds the Lambda deployment zip: handler, the pipette package and the shared taxonomy.
# Usage: ingest/package.sh [output.zip]   (default: ingest/lambda.zip)
set -euo pipefail
cd "$(dirname "$0")"
OUT="${1:-$PWD/lambda.zip}"
rm -rf build && mkdir -p build/pipette
cp handler.py build/
cp pipette/*.py build/pipette/
cp ../shared/taxonomy.json ../shared/journals.json build/pipette/
python - "$OUT" <<'PY'
import os, sys, zipfile
out = sys.argv[1]
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk("build"):
        for f in files:
            path = os.path.join(root, f)
            z.write(path, os.path.relpath(path, "build"))
print("wrote", out)
PY
