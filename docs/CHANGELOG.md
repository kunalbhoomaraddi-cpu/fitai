# Changelog

What was built, in the order it was built. Live app: https://fitai-app-pink.vercel.app

## Release 1.0: live in production (13 Nov 2026)

**Deployment**
- Frontend on Vercel, backend on Render (Singapore), database on Neon PostgreSQL, email through Brevo.
- `render.yaml` blueprint and `frontend/vercel.json` (SPA routing, long-cache assets, security headers).
- Production safety check: the API refuses to start with a weak JWT secret, a SQLite database, no email sender or no public CORS origin.
- Neon/Render `postgres://` URLs are converted to the right driver automatically.
- Real visitor IPs behind Render's proxy, so per-IP rate limits work.
- Friendly "FitAI is waking up" message while the free server starts.

**Email that works on free hosting**
- Brevo HTTPS API (Render's free plan blocks SMTP), with the Gmail API as an alternative; SMTP still works locally.
- Pasted settings are trimmed, so a stray line break can't break a key.
- API keys and passwords are replaced with `[hidden]` in every logged error.

**Correct dates for every user**
- The browser sends its time zone; "today", "this week" and streaks follow the user's own clock (India by default).
- The zone is saved on the account, and legacy names such as `Asia/Calcutta` are accepted.

**Safe public demo**
- Each "Explore the demo" click gets a private copy of the sample account, deleted after 6 hours (at most 100 at once).
- Visitors can't see each other's changes or sign each other out; the demo email domain is reserved.

**Code quality**
- ESLint 9 (frontend) and Ruff (backend), both passing.
- GitHub Actions runs lint, 95 backend tests on SQLite and PostgreSQL 16, and a production build on every push.
- `scripts/test-all.sh` runs the same checks locally.

**Presentation**
- README with live link, screenshots, architecture diagram and tech stack; guides moved into `docs/`.
- Stock photos stored in the repo, so the live site matches local.
- Mobile fixes on the workout planner header; spelling fixes.

## Phase 0: core product

**Indian food library and exercise demos**
- About 200 home-style Indian dishes, searchable by regional names and common misspellings, logged by household portions (roti, katori, dosa).
- Start-and-end photo demos with step-by-step cues for 62 of 63 exercises.

**Progress photos**
- Private front, side and back photos with a timeline and a before/after slider.
- Photos are stored privately, stripped of GPS and camera data, and served only to their owner.

**Forgot password and weekly AI check-in**
- Password reset by emailed code; unknown emails are told they aren't registered; resetting signs out other devices.
- Weekly review: a 0–100 score from workouts, logging and protein days, with next week's targets. Numbers come from code; the AI only writes the wording.

**First version**
- Accounts with email verification and a one-time code on every login.
- Six-step onboarding with BMR, TDEE, calorie and macro targets.
- AI coach (Gemini function calling over 12 backend tools, with a rule-based fallback).
- Diet planner, workout planner with guided sessions, nutrition tracker (Open Food Facts + offline database), progress tracker with trend and plateau detection, dashboard with streaks and achievements.
