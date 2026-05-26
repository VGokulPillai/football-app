#!/usr/bin/env bash
# Build frontend and deploy + restart the Databricks App (dev target).
# Run from anywhere:  ./scripts/deploy-dev.sh   OR   bash scripts/deploy-dev.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "==> npm run build (frontend)"
(cd frontend && npm run build)
echo "==> databricks bundle deploy -t dev"
databricks bundle deploy -t dev
echo "==> databricks bundle run mufc_app -t dev"
databricks bundle run mufc_app -t dev
echo "==> Done."
