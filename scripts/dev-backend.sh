#!/usr/bin/env bash
# Run only the API (assumes ./start.sh ran once, or a venv exists in backend/.venv)
set -e
cd "$(dirname "$0")/../backend"
source .venv/bin/activate
exec uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
