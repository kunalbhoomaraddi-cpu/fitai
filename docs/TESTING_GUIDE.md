# Testing Guide

## Run everything

```bash
./scripts/test-all.sh     # backend lint + tests, frontend lint + type-check + production build
```

The same checks run automatically on GitHub for every push and pull request (`.github/workflows/ci.yml`):
backend tests run twice, once on SQLite and once on PostgreSQL 16.

## Backend (pytest + ruff)

```bash
cd backend && source .venv/bin/activate
pip install -r requirements-dev.txt     # once: adds ruff
ruff check .                            # lint
python -m pytest -q                     # 89 tests
```

The tests use a throwaway SQLite file, no external APIs and no LLM keys, so they are deterministic and need no network.
To run them on PostgreSQL instead, point `TEST_DATABASE_URL` at an empty database:

```bash
TEST_DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/fitai_test python -m pytest -q
```

| File | Covers |
|---|---|
| `test_calculations.py` | Mifflin-St Jeor (male, female, sex-neutral), TDEE multipliers, 500 kcal deficit cap, calorie floor, surplus cap, macro energy balance, BMI, invalid inputs, the streak rule (one rest day allowed) |
| `test_api.py` | Health, registration validation and duplicates, case-insensitive login, protected endpoints (401), profile, dashboard, nutrition CRUD **and cross-user isolation**, offline food search, weight tracking, measurements, diet generation respecting restrictions, workout generation respecting equipment, coach demo mode invoking tools, settings and password |
| `test_verification.py` | Unverified users blocked (403), wrong and right codes, 5-attempt lockout, resend cooldown, codes hashed at rest, automatic database upgrade for older databases |
| `test_login_otp.py` | Code required on every login, pending token can't reach the API, attempt lockout, single-use codes, resend cooldown |
| `test_password_reset.py` | Reset flow, unknown emails rejected, attempt limit, expiry and resend cooldown, other sessions signed out |
| `test_checkins.py` | Weekly check-in facts and score, targets, fast-weight-loss warning, AI wording with rules fallback |
| `test_photos.py` | Upload validation, EXIF/GPS stripping, thumbnails, owner-only access, demo restrictions |
| `test_indian_foods.py` | Regional names, misspellings, word-boundary matching, household portions |
| `test_exercise_demos.py` | Every generated exercise has a demo and steps |
| `test_timezone.py` | "Today" follows the user's clock (India just after midnight on a UTC server), saved time zone, legacy zone names |
| `test_demo.py` | Each demo visitor gets a private copy, copies expire, the demo email domain is reserved |
| `test_deploy_config.py` | Production safety checks, Neon URL normalising, Brevo email API |
| `test_ai_provider.py`, `test_real_llm_paths.py` | Provider selection, Gemini schema conversion, a simulated tool-calling round trip |

## Frontend

```bash
cd frontend
npm run lint          # ESLint (TypeScript + React hooks rules)
npm run typecheck     # strict TypeScript
npm run build         # tsc + vite production build
```

## End-to-end journey (manual checklist)

1. Register → 2. Complete the 6-step onboarding → 3. Dashboard shows your numbers → 4. Coach: ask "How many calories should I consume?" (a tool card appears) → 5. Diet Planner: generate, swap a food, mark a meal eaten, save → 6. Workout Planner: generate, open an exercise demo, start, complete sets with the rest timer, finish → 7. Nutrition: search "jolada rotti", add 2 rotis → 8. Progress: log a weight, add a progress photo → 9. Weekly Check-in: run it → 10. Log out, then try **Explore the demo**. Also check at a 390 px width.

## Testing with a real Gemini key

Add `GEMINI_API_KEY` to `backend/.env`, restart, and ask the coach "How much weight have I lost this month?". The response metadata should show the Gemini model, with *Weight history* in the tools list.
