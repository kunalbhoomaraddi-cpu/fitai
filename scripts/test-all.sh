#!/usr/bin/env bash
# Runs every check that GitHub CI runs: backend lint + tests, frontend lint + type-check + build.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "▸ Backend lint + tests"
( cd "$ROOT/backend" && source .venv/bin/activate \
  && { command -v ruff >/dev/null || pip install -q -r requirements-dev.txt; } \
  && ruff check . && python -m pytest -q )
echo "▸ Frontend lint + type-check + production build"
( cd "$ROOT/frontend" && npm run lint && npm run build )
echo "✓ All checks passed"
