# Deployment Guide

FitAI goes live on three free services:

| Part | Host | Notes |
|---|---|---|
| Database | **Neon** (PostgreSQL) | Already in use. |
| Backend API | **Render** (free web service) | Configured by `render.yaml`. Sleeps after ~15 idle minutes; the first request then takes about a minute. |
| Frontend | **Vercel** | Configured by `frontend/vercel.json`. |
| Email codes | **Brevo** (300 emails/day free) | Render's free plan blocks SMTP, so Gmail SMTP won't work there. |

The backend **refuses to start in production** if a setting is unsafe or missing (weak `JWT_SECRET`,
SQLite database, no email sender, no public `CORS_ORIGINS`). Render's log lists exactly what to fix.

## Before you start: fresh secrets

These were shared in chats earlier, so replace them; never paste the new values into any chat.

1. **Gemini key**: aistudio.google.com/apikey → delete the old key → create a new one.
2. **Neon password**: Neon → your project → Roles → `Reset password`. Copy the new connection string.
3. **Gmail app password**: myaccount.google.com/apppasswords → delete the old one (Brevo replaces it online; create a new one only if you still want Gmail locally).
4. **JWT secret**: Render generates one automatically. For local `.env`, run
   `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`.

Update `backend/.env` on your Mac with the new values. It is git-ignored and never committed.

## 1. Brevo (email)

1. Sign up at brevo.com (free plan).
2. Settings → **Senders, domains & dedicated IPs** → Senders → **Add a sender** with your Gmail address → click the link in the email Brevo sends.
3. Settings → **SMTP & API** → API keys → **Generate a new API key**. Keep it for step 2.

## 2. Render (backend)

1. render.com → sign in with GitHub → **New → Blueprint** → choose the `fitai` repo. Render reads `render.yaml`.
2. Fill in the values it asks for:
   - `DATABASE_URL`: Neon connection string (`postgresql://…?sslmode=require` is fine; FitAI adds the driver itself)
   - `CORS_ORIGINS`: leave as `https://example.com` for now; you set the real Vercel URL in step 4
   - `GEMINI_API_KEY`: the new key
   - `BREVO_API_KEY`: from Brevo
   - `EMAIL_FROM`: `FitAI <your.verified@gmail.com>`
3. **Apply**. When it's live, open `https://<your-service>.onrender.com/api/health` → you should see `"status":"ok"`.

## 3. Vercel (frontend)

1. vercel.com → sign in with GitHub → **Add New → Project** → import `fitai`.
2. **Root Directory**: `frontend`. Framework is detected as Vite.
3. Environment variable: `VITE_API_URL` = `https://<your-service>.onrender.com/api`
4. **Deploy**. Note the site URL, e.g. `https://fitai-xyz.vercel.app`.

## 4. Connect them

Render → fitai-api → Environment → set `CORS_ORIGINS` to your Vercel URL (no trailing slash) → Save.
Render redeploys. Open the Vercel site, try the demo, then register with a real email.

## Updating later

Push to GitHub `main`. Render and Vercel both redeploy automatically.

## Checks before every push

```bash
cd backend && python3 -m pytest -q && ruff check .      # pip install -r requirements-dev.txt once
cd ../frontend && npm run lint && npm run build
```

## Other options

- **Docker Compose (single server)**: `docker compose up --build` with `ENVIRONMENT=production` and the same variables.
- **Paid Render plan ($7/month)**: no sleeping, and SMTP works, so Gmail can be used instead of Brevo.
