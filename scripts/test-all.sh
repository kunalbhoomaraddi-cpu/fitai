#!/usr/bin/env bash
# Runs backend tests, frontend type-check and production build.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "▸ Backend tests"; ( cd "$ROOT/backend" && source .venv/bin/activate && python -m pytest -q )
echo "▸ Frontend type-check + production build"; ( cd "$ROOT/frontend" && npm run build )
echo "✓ All checks passed"
