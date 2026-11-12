# Deployment Guide

Deployment isn't required for local use. This guide prepares FitAI for the cloud without changing the architecture.

## 1. Docker Compose (single host)

```bash
cp backend/.env.example backend/.env
# set ENVIRONMENT=production, a strong JWT_SECRET, GEMINI_API_KEY, CORS_ORIGINS=https://your-domain
docker compose up --build -d
# app: http://localhost:8080   API: http://localhost:8000/api/health
```

- `backend`: python:3.12-slim, non-root user, health check on `/api/health`, SQLite persisted in the `fitai-data` volume
- `frontend`: multi-stage Node build served by nginx, `/api` reverse-proxied to the backend, SPA fallback, security headers, long-cache assets

Run `./scripts/fetch_photos.sh` **before** building so the photos are baked into the image.

## 2. PostgreSQL

```bash
docker compose --profile postgres up -d postgres
# in backend/.env (or the compose environment):
DATABASE_URL=postgresql+psycopg://fitai:<password>@postgres:5432/fitai
docker compose up --build -d backend frontend
```

The models use only portable types (JSON maps to JSON/JSONB). The backend Docker image installs `psycopg[binary]`. For local Postgres without Docker, uncomment it in `requirements.txt`.

**Schema migrations:** startup runs an idempotent `create_all`. Before evolving the schema in production, add Alembic:

```bash
pip install alembic && alembic init migrations
# set target_metadata = app.database.Base.metadata in migrations/env.py
alembic revision --autogenerate -m "baseline" && alembic upgrade head
```

## 3. Managed platforms

| Piece | Options |
|---|---|
| Backend container | Google Cloud Run, Render, Railway, Fly.io, AWS App Runner |
| Database | Cloud SQL, Neon, Supabase, RDS (PostgreSQL) |
| Frontend | The nginx container, or a static host (Vercel, Netlify, Cloudflare Pages) with `VITE_API_URL=https://api.your-domain/api` |

Cloud Run example:

```bash
gcloud run deploy fitai-api --source backend --region asia-south1 \
  --set-env-vars ENVIRONMENT=production,AI_PROVIDER=auto,CORS_ORIGINS=https://app.example.com \
  --set-secrets JWT_SECRET=fitai-jwt:latest,GEMINI_API_KEY=gemini-key:latest,DATABASE_URL=fitai-db-url:latest
```

## 4. Production checklist

- [ ] `ENVIRONMENT=production` and a unique 48+ character `JWT_SECRET` stored in a secret manager
- [ ] PostgreSQL with backups, plus Alembic migrations
- [ ] `CORS_ORIGINS` set to your exact frontend origin(s)
- [ ] HTTPS everywhere (managed TLS or a reverse proxy)
- [ ] `OFF_USER_AGENT` identifies your app and a contact email
- [ ] Monitoring on `/api/health`, with logs collected from stdout
- [ ] Gemini quota reviewed. A paid tier or Groq fallback for higher traffic
- [ ] The in-memory rate limiter is per-process. For multiple instances, use a shared store (e.g. Redis) or gateway rate limiting
- [ ] Optional single container: `npm run build`, and the backend serves `frontend/dist` automatically when it exists
