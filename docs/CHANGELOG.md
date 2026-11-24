# Changelog

What was built, in the order it was built. Live app: https://fitai-app-pink.vercel.app

## 24 Nov 2026: v2 begins

- **Lift progress charts.** Workouts, then *Lifts & history*, shows each lift over time: the estimated 1-rep max from your best set each session (Epley formula, worked out in code), your best, the change over the last 8 weeks and how many personal records you've set. Bodyweight moves track most reps; planks track the longest hold. Finishing a workout now lists any new personal records. New endpoint `GET /api/workouts/lifts`.
- **Kilograms or pounds for lifts.** The set table, *Last time* column, lift charts, personal records and the workout total now follow the unit chosen in Settings. Weights are still stored in kg, so switching units never changes the data; 135 lb typed shows as 135 lb again.
- **Fixed: decimals in the set table.** Typing 42.5 used to lose the dot as soon as it was typed; each box now keeps exactly what you type.
- **Fixed: old achievements popping up again.** Finishing a workout listed every achievement the user hadn't opened yet, so several pop-ups could stack up and cover the summary. It now lists only the ones that workout earned, and several at once appear as one message.
- **Log every set, like a gym notebook** (learned from Hevy). During a workout each exercise has a set table: *Last time* shows what you lifted in your previous session, then kg and reps for today. One tap ticks a set, fills in last time's numbers if you left the boxes empty, and starts the rest timer. The rest timer stays pinned at the top while you scroll. Bodyweight exercises hide the kg column; timed ones (planks) log seconds. The finish screen shows total kg lifted. Stored inside the session's existing data, so no database change. Demo accounts get realistic past sets.
- **One-tap re-logging** (learned from MacroFactor). Opening *Add food* shows your recent foods; one tap adds the same portion to the chosen meal. New endpoint `GET /api/nutrition/recent`.
- **Dashboard puts today first** (learned from WHOOP's home screen). The check-in reminder moved below today's plan and numbers.
- **New look across the whole app.** Same dark theme and lime, but no longer the generic "AI website" style:
  - Fonts: Big Shoulders Display, a condensed scoreboard face, for headings and numbers; IBM Plex Sans for text (replacing Inter and Manrope).
  - Removed glows, gradient text, shine effects, blurred light blobs, small all-caps labels and text joined with "·".
  - Plain page names in the menu and titles: Coach, Meal plan, Workouts, Food log, Progress.
  - The dashboard opens on today ("Lower strength today" or "Rest day"), with goal progress and a scoreboard of today's numbers.
  - The landing page shows a sample training log and plainer copy.
  - Calories are off-white everywhere, so they never clash with fat (amber).
  - Fixed: the dashboard goal ring sat on top of the gym photo and its text was unreadable.
  - Keyboard focus is always visible; error and fallback messages no longer mention developer settings.
- **Snap your meal.** On the Nutrition page, take or choose a photo of your plate. Gemini identifies each food and estimates its portion; calories and macros come from FitAI's food database (Indian dishes and reference foods). Foods the database doesn't know use the AI's estimate and are labelled "AI estimate"; unsure items say "Not sure, please check". Users adjust grams, untick items and add the rest to a meal in one tap. Photos are shrunk on the phone before upload, processed in memory and never stored. Limits: 30 photo analyses per user per day (10 in the demo) to protect the shared free AI quota.
- **Stricter dish matching.** Found in the first live photo test: Gemini saw "dal curry" and the database lookup matched it to "Egg Curry" because both contain "curry". Photo matching now ignores a single shared word, drops generic words like "curry" or "sabzi" before trying again ("dal curry" becomes Dal Tadka), and falls back to a labelled AI estimate if nothing truly matches. The food search box keeps its forgiving typo matching.

## 17 Nov 2026

- **Choose your training days.** New plans use the weekdays the user picks (for example Tue, Thu, Sat) instead of fixed Mon/Wed/Fri. Existing plans get a **Change days** button that moves the workouts without regenerating them.
- **Today in the workout planner.** The planner opens on today's workout. On a rest day it says so and shows the next workout, instead of showing Monday's.
- **Landing page first.** The app always opens on the landing page; signed-in users see "Open dashboard".
- **Safer account deletion.** Users type DELETE before "Delete permanently" unlocks.
- **Engineering review.** All checks re-run on both databases and in the browser; 7 of 11 dependency warnings fixed with safe updates (the other 4 need major upgrades and don't affect the live site); after login, FitAI only returns to its own pages; test warnings removed; Dependabot and an editor config added; docs refreshed.

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
