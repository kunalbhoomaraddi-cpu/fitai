# Testing Guide

## Run everything

```bash
./scripts/test-all.sh     # backend lint + tests, frontend lint + tests + type-check + production build
```

The same checks run automatically on GitHub for every push and pull request (`.github/workflows/ci.yml`):
backend tests run twice, once on SQLite and once on PostgreSQL 16.

## Backend (pytest + ruff)

```bash
cd backend && source .venv/bin/activate
pip install -r requirements-dev.txt     # once: adds ruff
ruff check .                            # lint
python -m pytest -q                     # 160 tests
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
| `test_meal_photo.py` | Snap your meal: database calculates (not the AI), AI estimates labelled, photo not stored, messy AI answers, AI failures, no-food photos, daily limit, login required, strict dish matching ("dal curry" never becomes "egg curry") |
| `test_lifts.py` | Lift progress (Epley estimated max capped at 12 reps, best set, personal records, bodyweight and timed moves) and auto-progression (rep ranges, add weight at the top of the range, lower-body and dumbbell jumps, add a rep, hold, fewer sets than planned, targets attached when a workout starts) |
| `test_barcode.py` | Barcode lookup: product mapped to a food with its serving size, cached, unknown codes, upstream failure, non-barcodes rejected, login required |
| `test_saved_meals.py` | Copy a meal to another day or meal, save / list / log / delete saved meals, empty meals refused, other users can't see or use them, deleted with the account |
| `test_training_days.py` | Plans on the user's chosen weekdays, moving an existing plan's days, dashboard follows the new days |
| `test_demo.py` | Each demo visitor gets a private copy, copies expire, the demo email domain is reserved |
| `test_deploy_config.py` | Production safety checks, Neon URL normalising, trimming pasted settings, keys hidden in logs, Brevo and Gmail API email |
| `test_api.py` (consent) | Sign-up refused without accepting the terms, older accounts asked once, demo copies never asked |
| `test_monitoring.py` | Error reports carry no request body, query, token, cookies, user or local variables; Sentry off without a DSN; rate-limit counters are forgotten after their window |
| `test_lifestyle.py` | Water goal and logging (undo, no negatives, no future days, private), streak rules (one rest day, freezes earned and used, at most 2, break days not missed), breaks (maintenance target, dashboard, end now, limits, overlaps, privacy, coach told) |
| `test_swap_export_language.py` | Swap mid-workout (same muscle, own equipment only, never one already planned, keeps sets, refused after logging or finishing), hotel-room workout needs no equipment, export ZIP (own data only, photos, CSV, no secrets), coach language in the prompt, localized starter questions, demo notice |
| `test_ai_provider.py`, `test_real_llm_paths.py` | Provider selection, Gemini schema conversion, a simulated tool-calling round trip |

## Frontend

```bash
cd frontend
npm run lint          # ESLint (TypeScript + React hooks rules)
npm run typecheck     # strict TypeScript
npm test              # 25 Vitest + Testing Library tests
npm run build         # tsc + vite production build
```

| Test file | What it checks |
|---|---|
| `utils/format.test.ts` | kg/lb display and round trips (135 lb stays 135), set formatting |
| `utils/workout.test.ts` | Typed decimals and commas, "8–12" read as 8, progression tips in kg and lb |
| `utils/calendar.test.ts` | Next training date, one weekly event per day plus the check-in, escaping |
| `utils/monitoring.test.ts` | Browser error reports drop users, headers, queries, console output and clicks |
| `components/workout/NumCell.test.tsx` | Typing 42.5 key by key, letters ignored |
| `pages/Register/Register.test.tsx` | Sign-up blocked until the consent box is ticked; links to both documents |
| `components/dashboard/QuickLog.test.tsx` | Water: add a glass, undo disabled at zero, number restored if saving fails; weigh-in in lb saved as kg, impossible numbers refused; ending a break |
| `components/workout/SwapExercise.test.tsx` | Alternatives listed and the picked one swapped |
| `components/ConsentGate.test.tsx` | One-time prompt: hidden once accepted, needs the tick, records consent, sign-out option |

## End-to-end journey (manual checklist)

1. Register → 2. Complete the 6-step onboarding → 3. Dashboard shows your numbers → 4. Coach: ask "How many calories should I consume?" (a tool card appears) → 5. Diet Planner: generate, swap a food, mark a meal eaten, save → 6. Workout Planner: generate, open an exercise demo, start, complete sets with the rest timer, finish → 7. Nutrition: search "jolada rotti", add 2 rotis → 8. Progress: log a weight, add a progress photo → 9. Weekly Check-in: run it → 10. Log out, then try **Explore the demo**. Also check at a 390 px width.

## Testing with a real Gemini key

Add `GEMINI_API_KEY` to `backend/.env`, restart, and ask the coach "How much weight have I lost this month?". The response metadata should show the Gemini model, with *Weight history* in the tools list.
