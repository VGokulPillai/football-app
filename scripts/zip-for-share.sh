#!/usr/bin/env bash
# Build ../mufc.zip for sharing: no node_modules / .databricks / dist, no .env files,
# no internal Databricks host or CLI profile, and API_FOOTBALL_KEY forced empty in the archive.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PARENT="$(cd "$ROOT/.." && pwd)"
OUT_ZIP="$PARENT/mufc.zip"
STAGING="$PARENT/_mufc_zip_staging"

rm -rf "$STAGING" "$OUT_ZIP"
mkdir -p "$STAGING/mufc"
rsync -a \
  --exclude='node_modules' \
  --exclude='.databricks' \
  --exclude='frontend/dist' \
  --exclude='__pycache__' \
  --exclude='.venv' \
  --exclude='venv' \
  --exclude='*.tsbuildinfo' \
  --exclude='.DS_Store' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='*.pem' \
  --exclude='*.p12' \
  --exclude='mufc.zip' \
  --exclude='_mufc_zip_staging' \
  "$ROOT/" "$STAGING/mufc/"

DBY="$STAGING/mufc/databricks.yml"
if [[ -f "$DBY" ]]; then
  sed -i '' \
    -e 's|https://[^[:space:]]*\.cloud\.databricks\.com|https://YOUR_WORKSPACE.cloud.databricks.com|g' \
    -e 's|https://[^[:space:]]*\.azuredatabricks\.net|https://YOUR_WORKSPACE.cloud.databricks.com|g' \
    -e 's|default: "https://[^"]*"|default: "https://YOUR_WORKSPACE.cloud.databricks.com"|g' \
    "$DBY"
  sed -i '' 's/^      profile: .*/      profile: DEFAULT/' "$DBY"
fi

# Never ship a non-empty API-Football key in app.yaml (staged copy only; source unchanged)
APPYAML="$STAGING/mufc/app.yaml"
if [[ -f "$APPYAML" ]]; then
  export _ZIP_APPYAML="$APPYAML"
  python3 <<'PY'
import re, pathlib, os
p = pathlib.Path(os.environ["_ZIP_APPYAML"])
t = p.read_text()
t = re.sub(
    r"(^  - name: API_FOOTBALL_KEY\s*\n)(    value:).*",
    lambda m: m.group(1) + m.group(2) + ' ""',
    t,
    count=1,
    flags=re.MULTILINE,
)
p.write_text(t)
PY
  unset _ZIP_APPYAML
fi

(cd "$STAGING" && zip -qr "$OUT_ZIP" mufc)
rm -rf "$STAGING"
echo "Wrote $OUT_ZIP"
