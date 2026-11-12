# Environment Configuration

All secrets live in **`backend/.env`**, which is git-ignored. The browser never sees an API key. The frontend talks only to `/api`, and the backend calls the LLM.

## Required API keys

| Key | Required? | Where to get it | Free tier |
|---|---|---|---|
| `GEMINI_API_KEY` | Optional (without it: demo mode) | https://aistudio.google.com/apikey | Yes. Free-tier access covers the Flash and Flash-Lite models, with per-minute and per-day limits shown in AI Studio. Limits change, so FitAI never assumes unlimited use |
| Gmail App Password (`SMTP_PASSWORD`) | Optional (without it, development prints codes in the terminal; production refuses to register users) | https://myaccount.google.com/apppasswords (needs 2-Step Verification) | Yes. Gmail allows roughly 500 emails a day, plenty for a small app |
| `GROQ_API_KEY` | Optional alternative | https://console.groq.com/keys | Yes, rate-limited |
| Open Food Facts | No key | — | About 10 search requests a minute per IP. FitAI caches results and stays under 8 a minute, and requires an identifying `OFF_USER_AGENT` |
| wger | No key for public exercise data | — | FitAI caches results and limits itself to 30 a minute |

## Backend variables (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `ENVIRONMENT` | `development` | `development`, `production` or `test`. In production FitAI logs an error if `JWT_SECRET` is still the default |
| `LOG_LEVEL` | `INFO` | Python log level. Secrets are never logged |
| `DATABASE_URL` | `sqlite:///./fitai.db` | SQLAlchemy URL, e.g. `postgresql+psycopg://user:pass@host:5432/fitai` |
| `JWT_SECRET` | dev placeholder | **Set a long random value.** `start.sh` generates one automatically |
| `JWT_EXPIRE_MINUTES` | `10080` (7 days) | Session lifetime |
| `CORS_ORIGINS` | localhost:5173, :8080 | Comma-separated allowed browser origins |
| `AI_PROVIDER` | `auto` | `auto` (Gemini → Groq → demo), `gemini`, `groq` or `mock` |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Primary model (stable Flash, Nov 2026) |
| `GEMINI_FALLBACK_MODEL` | `gemini-3.5-flash-lite` | Used after retries fail with 429/5xx/404 |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Check https://console.groq.com/docs/models for current IDs |
| `AI_TIMEOUT_SECONDS` | `45` | Per-request timeout |
| `AI_MAX_RETRIES` | `2` | Exponential backoff retries on 429/5xx |
| `AI_REQUESTS_PER_MINUTE` | `20` | Per-user limit on AI endpoints (returns HTTP 429) |
| `EMAIL_VERIFICATION_REQUIRED` | `true` | New accounts must verify a 6-digit email code. Existing accounts are marked verified automatically |
| `LOGIN_OTP_REQUIRED` | `true` | Two-step login: after the password, a new 6-digit code is emailed on every login. The demo account skips it |
| `AUTH_REQUESTS_PER_MINUTE` | `20` | Per-IP limit on login, register and code checks |
| `SMTP_HOST` / `SMTP_PORT` | empty / `587` | Free option: `smtp.gmail.com` and `587`. Port `465` uses SSL instead of STARTTLS |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | empty | Gmail address and a 16-character **App Password** (not your normal password) |
| `SMTP_FROM` | the username | Sender shown to users, e.g. `FitAI <you@gmail.com>` |
| `SMTP_USE_TLS` | `true` | STARTTLS on port 587 |
| `VERIFICATION_CODE_MINUTES` | `15` | Code lifetime |
| `ENABLE_EXTERNAL_APIS` | `true` | Set `false` to work fully offline (reference data only) |
| `OFF_BASE_URL` | `https://world.openfoodfacts.org` | Open Food Facts base URL |
| `OFF_USER_AGENT` | `FitAI/1.0 (...)` | Identify your app and contact, as Open Food Facts requires |
| `WGER_BASE_URL` | `https://wger.de/api/v2` | wger API base |
| `EXTERNAL_TIMEOUT_SECONDS` | `6` | Timeout for food and exercise APIs |

## Frontend variables (`frontend/.env`, optional)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | empty (same-origin `/api`) | Set only if the API is on another origin, e.g. `https://api.example.com/api` |
| `VITE_API_PROXY` | `http://127.0.0.1:8000` | Dev-server proxy target |

`VITE_*` values are embedded in the public bundle, so never put secrets there.

## Per-user AI preference

**Settings → AI provider** stores a preference (`auto`, `gemini`, `groq` or `mock`) for each user. It only chooses among providers that have server-side keys configured.
