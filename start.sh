#!/usr/bin/env bash
# FitAI one-command local start (macOS / Linux).  Usage: ./start.sh
# First run: creates backend/.venv, installs deps, creates backend/.env with a random JWT secret,
# installs frontend packages, downloads optional photos, then runs backend (:8000) + frontend (:5173).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
G='\033[1;32m'; Y='\033[1;33m'; R='\033[1;31m'; N='\033[0m'
say() { echo -e "${G}▸${N} $*"; }
warn() { echo -e "${Y}!${N} $*"; }
die() { echo -e "${R}✗${N} $*"; exit 1; }

# ── prerequisites ───────────────────────────────────────────
PY=""
for c in python3.13 python3.12 python3.11 python3.10 python3; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)' 2>/dev/null; then PY="$c"; break; fi
done
[[ -n "$PY" ]] || die "Python 3.10+ is required. On macOS: brew install python@3.12"
command -v node >/dev/null || die "Node.js 18+ is required. On macOS: brew install node"
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
(( NODE_MAJOR >= 18 )) || die "Node.js 18+ required (found $(node -v))."
say "Using $($PY --version) and Node $(node -v)"

# ── backend ─────────────────────────────────────────────────
cd "$ROOT/backend"
if [[ ! -d .venv ]]; then say "Creating Python virtual environment"; "$PY" -m venv .venv; fi
# shellcheck disable=SC1091
source .venv/bin/activate
if [[ ! -f .venv/.deps-installed ]] || [[ requirements.txt -nt .venv/.deps-installed ]]; then
  say "Installing backend dependencies"; pip install -q --upgrade pip; pip install -q -r requirements.txt; touch .venv/.deps-installed
fi
if [[ ! -f .env ]]; then
  say "Creating backend/.env from template (with a random JWT secret)"
  cp .env.example .env
  SECRET=$(python -c 'import secrets; print(secrets.token_urlsafe(48))')
  sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=${SECRET}|" .env && rm -f .env.bak
fi
grep -q '^GEMINI_API_KEY=.\+' .env || warn "No GEMINI_API_KEY in backend/.env → AI coach runs in labelled demo mode. Add a free key from https://aistudio.google.com/apikey"
deactivate

# ── frontend ────────────────────────────────────────────────
cd "$ROOT/frontend"
if [[ ! -d node_modules ]]; then say "Installing frontend dependencies"; npm install --no-audit --no-fund; fi
if [[ -z "$(ls -A public/images/photos 2>/dev/null | grep -i jpg || true)" ]]; then
  say "Downloading optional Unsplash photos (skips gracefully if offline)"; "$ROOT/scripts/fetch_photos.sh" || warn "Photo download skipped — bundled artwork will be used"
fi

# ── run ─────────────────────────────────────────────────────
cd "$ROOT"
cleanup() { trap - INT TERM EXIT; echo; say "Stopping FitAI"; kill 0 2>/dev/null || true; }
trap cleanup INT TERM EXIT
say "Starting backend  → http://127.0.0.1:8000  (API docs: /docs)"
( cd backend && source .venv/bin/activate && exec uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 ) &
for i in {1..30}; do curl -fs http://127.0.0.1:8000/api/health >/dev/null 2>&1 && break; sleep 0.5; done
say "Starting frontend → http://localhost:5173"
( cd frontend && exec npm run dev -- --host 127.0.0.1 ) &
sleep 2
echo -e "\n${G}FitAI is running:${N} open http://localhost:5173  ·  press Ctrl+C to stop\n"
( command -v open >/dev/null && open http://localhost:5173 ) >/dev/null 2>&1 || true
wait
