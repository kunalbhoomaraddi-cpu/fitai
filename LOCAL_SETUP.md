# Local Setup (macOS, Apple Silicon)

## 1. Prerequisites

| Tool | Version | Install |
|---|---|---|
| Python | **3.10 or newer** (3.12 recommended) | `brew install python@3.12` |
| Node.js | **18 or newer** (20 LTS recommended) | `brew install node` |
| Homebrew | — | https://brew.sh |

> macOS ships an older system `python3`. `start.sh` automatically picks `python3.13`, `python3.12`, `python3.11` or `python3.10` if one is installed.

## 2. One-command start

```bash
cd FitAI
./start.sh
```

On first run the script:
1. creates `backend/.venv` and installs `backend/requirements.txt`
2. creates `backend/.env` from `.env.example` with a **random JWT secret**
3. runs `npm install` in `frontend/`
4. downloads the optional Unsplash photos (`scripts/fetch_photos.sh`); if that fails, the app uses its bundled artwork
5. starts the API on **http://127.0.0.1:8000** (docs at `/docs`) and the app on **http://localhost:5173**

Press **Ctrl+C** to stop both.

## 3. Manual start (two terminals)

```bash
# Terminal 1: backend
cd FitAI/backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # then edit JWT_SECRET / GEMINI_API_KEY
uvicorn app.main:app --reload   # http://127.0.0.1:8000
```

```bash
# Terminal 2: frontend
cd FitAI/frontend
npm install
npm run dev                     # http://localhost:5173 (proxies /api → :8000)
```

## 4. Enable the real AI coach

1. Get a free key at https://aistudio.google.com/apikey
2. In `backend/.env`, set `GEMINI_API_KEY=...`
3. Restart the backend. **Settings → AI provider** should now show `gemini · gemini-3.8-flash`.

Without a key, everything works in **demo mode**. The coach uses a rule-based engine over the same tools, and every answer is labelled *Demo response*.

## 5. Email verification (free with Gmail)

New accounts must enter a 6-digit code sent by email, and **every login** also asks for a fresh emailed code (two-step login; set `LOGIN_OTP_REQUIRED=false` to turn it off). Until email is set up, the code is printed in the Terminal window running FitAI. Look for a block with `CODE: 123456`.

To send real emails for free:
1. Turn on **2-Step Verification** for your Google account: https://myaccount.google.com/security
2. Open https://myaccount.google.com/apppasswords, name it **FitAI** and click **Create**. Copy the 16-letter password and remove the spaces.
3. In `backend/.env`, set:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=your.address@gmail.com
   SMTP_PASSWORD=your16letterpassword
   SMTP_FROM=FitAI <your.address@gmail.com>
   ```
4. Restart FitAI and register with any email. The code arrives within a few seconds; check spam the first time.

Security: codes are stored only as hashes, expire after 15 minutes, lock after 5 wrong tries, and can be resent once every 60 seconds.

## 6. Database

SQLite file: `backend/fitai.db`. Tables are created automatically on startup. To reset: `./scripts/reset-db.sh`. The **Explore the demo** button recreates the demo account each time.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Python 3.10+ is required` | `brew install python@3.12`, then rerun `./start.sh` |
| `zsh: permission denied: ./start.sh` | `chmod +x start.sh scripts/*.sh` |
| "Cannot reach the FitAI server" in the UI | The backend isn't running on :8000. Check terminal 1 for errors |
| `Address already in use` (8000 or 5173) | `lsof -i :8000` then `kill <PID>`, or run uvicorn with `--port 8001` and set `VITE_API_PROXY=http://127.0.0.1:8001` |
| Coach says "Gemini is unavailable… demo response" | Check the key, model name and quota. Free tiers have per-minute and per-day limits (RPD resets at midnight Pacific). FitAI retries, tries `GEMINI_FALLBACK_MODEL`, then falls back to demo |
| `404 model not found` | Google renames models over time. Set `GEMINI_MODEL` to a current Flash model from https://ai.google.dev/gemini-api/docs/models |
| Food search shows "reference foods" | Open Food Facts is unreachable or rate-limited (about 10 searches a minute). Wait a minute. Custom foods always work |
| Photos missing (artwork shown) | Run `./scripts/fetch_photos.sh` while online. The artwork fallback is intentional |
| `bcrypt` / `pydantic-core` build errors | Use Python 3.12 (prebuilt arm64 wheels), recreate `.venv` and reinstall |
| No verification email arrives | Check spam. Make sure `SMTP_PASSWORD` is the 16-letter **App Password** (not your Gmail password), with no spaces. Terminal shows the exact error |
| `Username and Password not accepted` | 2-Step Verification is off, or the App Password was mistyped. Create a new one |
| Logged out unexpectedly | The JWT expired (7 days by default) or `JWT_SECRET` changed. Log in again |
| Blank page after `git pull` | `cd frontend && rm -rf node_modules && npm install` |
