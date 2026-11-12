# Testing Guide

## Run everything

```bash
./scripts/test-all.sh          # backend pytest + frontend type-check + production build
```

## Backend (pytest)

```bash
cd backend && source .venv/bin/activate
python -m pytest -q
```

The tests use an isolated SQLite file with no external APIs and no LLM keys, so they're deterministic and need no network. **41 tests** cover:

| File | Covers |
|---|---|
| `test_calculations.py` | Mifflin-St Jeor (male, female, sex-neutral), TDEE multipliers, 500 kcal deficit cap, calorie floor, surplus cap, macro energy balance, BMI, invalid inputs, the streak rule (one rest day allowed) |
| `test_api.py` | Health, registration validation and duplicates, case-insensitive login, protected endpoints (401), profile persistence and targets, dashboard, nutrition CRUD **and cross-user isolation**, offline food search, weight tracking and analysis, measurements, diet generation respecting vegetarian and nut restrictions plus regenerate, save and complete, workout generation respecting equipment plus start, finish and achievements, coach demo mode invoking tools and persisting conversations, demo account, settings and password |
| `test_verification.py` | Unverified users blocked (403), wrong and right codes, 5-attempt lockout, resend cooldown, codes hashed at rest, demo account pre-verified, automatic database upgrade for older databases |
| `test_login_otp.py` | Code required on every login, pending token can't reach the API, attempt lockout, a new login cancels the old pending one, single-use codes, resend cooldown, demo and unverified accounts skip it |
| `test_ai_provider.py` | Provider resolution with and without keys, Gemini schema conversion, and a simulated Gemini tool-calling round trip, including `thoughtSignature` preservation and the `functionResponse` payload |

## Frontend

```bash
cd frontend
npm run typecheck     # strict TypeScript
npm run build         # tsc + vite production build
```

## End-to-end journey (manual checklist)

1. Register → 2. Complete the 6-step onboarding → 3. Dashboard shows your numbers → 4. Coach: ask "How many calories should I consume?" (a tool card appears) → 5. Diet Planner: generate, swap a food, mark a meal eaten, save → 6. Workout Planner: generate, start, complete sets with the rest timer, finish (confetti and the First Rep badge) → 7. Nutrition: search "oats", add 60 g, add a custom food, edit and delete → 8. Progress: log a weight, run AI analysis → 9. Settings: switch to imperial (all weights convert) → 10. Log out, then try **Explore the demo**. Also check at a 390 px width.

## Testing with a real Gemini key

Add `GEMINI_API_KEY` to `backend/.env`, restart, and ask the coach "How much weight have I lost this month?". The response metadata should show `gemini · gemini-3.8-flash`, with *Weight history* in the tools list.
