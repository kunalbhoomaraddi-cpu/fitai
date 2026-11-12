# API Documentation

Base URL: `http://127.0.0.1:8000/api`. Interactive OpenAPI docs: **http://127.0.0.1:8000/docs**

Authentication: `Authorization: Bearer <access_token>` from `/auth/register`, `/auth/login` or `/auth/demo`. Errors return `{"detail": "message"}`, and validation errors add `errors: [{field, message}]`.

## Auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | `{full_name, email, password}` → `{access_token, user, verification}`. Password must be at least 8 characters, with a letter and a number. Sends a 6-digit code; every other endpoint returns **403** until it's verified |
| POST | `/auth/login` | `{email, password}`. With two-step login on → `{otp_required, otp_token, email_masked, delivery}` and a code is emailed (no session yet). Otherwise → token |
| POST | `/auth/login/verify` | `{otp_token, code}` → `{access_token, user}`. 5 attempts; a new login cancels the previous pending one |
| POST | `/auth/login/resend` | `{otp_token}` → new code (60 s cooldown) |
| POST | `/auth/demo` | Creates or resets the labelled demo account → token |
| GET | `/auth/me` | Current user (works before verification) |
| POST | `/auth/verify-email` | `{code: "123456"}` → verified user. 5 attempts per code |
| POST | `/auth/resend-code` | Sends a new code (60 s cooldown) → `{delivery: email|console}` |
| POST | `/auth/logout` | 204 (stateless JWT; the client discards the token) |

## Profile & calculations
| Method | Path | Description |
|---|---|---|
| GET | `/profile` | Fitness profile, or `null` before onboarding |
| PUT | `/profile` | Create or update (metric values). Completes onboarding |
| GET | `/profile/targets` | `{bmi, bmr, tdee, calories, macros, disclaimer}` |
| POST | `/profile/calculate` | Calculator for arbitrary inputs `{weight_kg, height_cm, age, gender, activity_level, goal}` |

## Dashboard
| GET | `/dashboard?refresh_recommendation=false` | Everything the dashboard needs: weight series, today's macros, 14-day history, workouts, upcoming workout, AI or rule-based daily recommendation (cached per day), quote, achievements, challenges |
|---|---|---|

## AI coach
| Method | Path | Description |
|---|---|---|
| GET | `/coach/status` | Active provider, model, `is_real_llm` and configuration message |
| GET | `/coach/suggestions` | Suggested prompts |
| POST | `/coach/chat` | `{message, conversation_id?}` → `{conversation_id, user_message, message: {content, cards[], tools_used[], provider}, is_real_llm, notice}` |
| GET | `/coach/conversations` | Conversation list |
| GET / DELETE | `/coach/conversations/{id}` | Messages, or delete |
| POST | `/coach/save` | Save a recommendation to the dashboard |
| GET | `/coach/saved` | Saved recommendations |

**Card types** in `message.cards`: `metrics`, `macros`, `weight_trend`, `workout`, `foods`, `nutrition_day`, `insights`, `saved`, `profile`.

## Diet planner
| Method | Path | Description |
|---|---|---|
| POST | `/diet/generate` | `{calorie_target?, protein_g?, carbs_g?, fat_g?, diet_preference?, food_restrictions?, meals_per_day: 3|4|5, budget, food_preferences?, use_ai}` |
| GET | `/diet/plans`, `/diet/plans/latest`, `/diet/plans/{id}` | List, latest or one plan |
| POST | `/diet/plans/{id}/save` | Mark as saved |
| POST | `/diet/plans/{id}/regenerate-meal` | `{slot}` |
| POST | `/diet/plans/{id}/replace-item` | `{slot, item_index}`: swaps a food for an equivalent with the same role and similar calories |
| POST | `/diet/plans/{id}/complete-meal` | `{slot, completed, log_to_tracker}`. Logs to or removes from the nutrition tracker |
| DELETE | `/diet/plans/{id}` | Delete |

## Workouts
| Method | Path | Description |
|---|---|---|
| POST | `/workouts/generate` | `{goal?, experience?, days_per_week?, equipment?, duration_minutes?, split, target_muscles[], recovery, use_ai}` |
| GET | `/workouts/plans`, `/workouts/plans/active`, `/workouts/plans/{id}` | Plans |
| POST / DELETE | `/workouts/plans/{id}/save`, `/workouts/plans/{id}` | Save or delete |
| POST | `/workouts/sessions/start` | `{plan_id?, day_index}`. Starts a session; any other in-progress session is abandoned |
| GET | `/workouts/sessions/active` | Current session |
| PATCH | `/workouts/sessions/{id}` | `{exercises?, status?}`. `completed` computes duration and returns `new_achievements` |
| GET | `/workouts/sessions` | Completed history |
| GET | `/workouts/stats` | Totals, streak, last 7 days, 8-week counts |
| GET | `/workouts/library?muscle=&equipment=` | Built-in exercise library |
| GET | `/workouts/exercise-info?name=` | wger enrichment (image, IDs) with library fallback |

## Nutrition
| Method | Path | Description |
|---|---|---|
| GET | `/nutrition/search?q=` | `{results[], source: open_food_facts|reference, warning}` |
| GET | `/nutrition/day?date=YYYY-MM-DD` | Entries, totals, by-meal breakdown, targets |
| POST | `/nutrition/entries` | `{meal, name, quantity_g, calories, protein_g, carbs_g, fat_g, source, eaten_on?}` |
| PATCH / DELETE | `/nutrition/entries/{id}` | Edit or delete (owner only) |
| GET | `/nutrition/history?days=14` | Daily totals |

## Progress
| Method | Path | Description |
|---|---|---|
| GET / POST | `/progress/weights` | List, or add `{weight_kg, recorded_on?, note?}` (syncs the profile's current weight) |
| DELETE | `/progress/weights/{id}` | Delete |
| GET / POST / DELETE | `/progress/measurements[/{id}]` | Body measurements (cm) |
| PUT | `/progress/target` | `{target_weight_kg}` |
| GET | `/progress/analysis` | Deterministic weight, workout and nutrition analysis with insights |
| POST | `/progress/ai-analysis` | LLM narrative grounded in the analysis (rule-based in demo mode) |
| GET | `/progress/achievements` | Evaluates and returns all badges |
| POST | `/progress/achievements/seen` | Marks notifications seen |
| GET | `/progress/challenges` | Weekly challenges |

## Settings
| Method | Path | Description |
|---|---|---|
| GET / PUT | `/settings` | `{full_name?, ai_provider_pref?, unit_system?}` |
| POST | `/settings/password` | `{current_password, new_password}` |
| DELETE | `/settings/account` | Deletes the user and all their data |

## Health
`GET /api/health` → `{"status":"ok", "environment", "ai": {gemini, groq, mock}}`


## Forgot password

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/forgot-password` | `{email}` | If the account exists, emails a 6-digit code and returns `{detail, reset_token, delivery, expires_in_minutes, resend_in_seconds}`. Unknown email → `404` ("No FitAI account found…"); demo account → `400`. Rate-limited per IP. |
| POST | `/api/auth/forgot-password/resend` | `{reset_token}` | 60-second cooldown (`429` if sooner). |
| POST | `/api/auth/reset-password` | `{reset_token, code, new_password}` | Codes are single-use, expire after 15 minutes and allow 5 attempts. On success the password is set and **every existing session is revoked**. |

`POST /api/settings/password` now returns `200 {detail, access_token}`. It signs out other devices; the client stores the new token so the current session continues.

## Weekly check-ins

| Method | Path | Notes |
|---|---|---|
| GET | `/api/checkins/current` | `{week_start, due, checkin}`. `due` is true when this week (starting Monday) has no check-in yet. |
| POST | `/api/checkins/generate` | Builds this week's check-in from the last 7 days, replacing any existing one for the same week. Returns `{id, score, facts, summary:{headline, wins[], focus[], next_week[]}, generated_by, is_ai, notice}`. AI rate-limited. |
| GET | `/api/checkins` | History, newest first (up to 26). |
| DELETE | `/api/checkins/{id}` | Deletes one of your check-ins. |

`facts` and `score` are deterministic. Score = 40 × min(workouts / planned, 1) + 30 × min(days logged / 5, 1) + 30 × min(protein days / 4, 1). A protein day means reaching at least 90% of the target. The weight change compares this week's average with the previous week's. Weight loss faster than about 1% of body weight per week is flagged.
