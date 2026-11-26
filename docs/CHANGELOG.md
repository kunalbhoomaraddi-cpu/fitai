# Changelog

What was built, in the order it was built. Live app: https://fitai-app-pink.vercel.app

## 26 Nov 2026: fixes found checking batch 2 live

- **Fixed: a slow AI service could hold the dashboard for minutes.** The daily tip waited up to 45 seconds per try, with retries and a backup model; live, a new account's first dashboard took 2 minutes while Gemini was slow. The tip now gets one 8-second try and otherwise uses the built-in tip. Coach chats keep the more patient limits.
- **Fixed: swaps in the Hotel-room workout offered gym equipment** (barbell squats, leg press). On the road, swaps now offer only no-equipment exercises.
- **Dashboard layout:** the Water, Weigh-in and break cards use two columns on medium screens (the break card full width) and three on wide ones, so nothing is squeezed.

## 26 Nov 2026: everyday features (v2 batch 2)

- **Water tracker.** A Water card on the dashboard: one tap per glass (250 ml), with undo. The goal is about 35 ml per kg of body weight, rounded to a glass and kept between 2 and 4 litres. New table `water_logs` and `GET/POST /api/nutrition/water`.
- **Quick weigh-in** from the dashboard, in kg or lb, without opening Progress.
- **Swap an exercise mid-workout.** Machine taken, or something doesn't feel right? *Swap* offers exercises for the same muscle (then close ones) using only your equipment, keeps the planned sets, and sets today's target from the last time you did the new one. Not offered once sets are logged, so nothing is lost. `GET /api/workouts/sessions/{id}/alternatives`, `POST /api/workouts/sessions/{id}/swap`.
- **Streak freezes.** Every 7 workouts in a streak earns a freeze (up to 2). A freeze covers one extra missed day automatically, so one busy week doesn't wipe out a long streak. Shown next to the streak on the dashboard.
- **Travel and festival breaks.** Set dates (up to 21 days) and FitAI moves calories to maintenance, pauses the workout streak, and tells the coach. Travel breaks put a no-equipment **Hotel-room workout** on the dashboard; festival breaks get guilt-free festival tips. New table `breaks` and `/api/profile/breaks`.
- **Export my data.** Settings, then *Export my data*, downloads a ZIP: every record as JSON, the food log, weigh-ins and every workout set as CSV, and the original progress photos. No password hashes or sign-in codes. Limited to 5 exports an hour. `GET /api/settings/export`. The privacy policy now lists this right.
- **Coach in Hindi or Kannada.** Pick English, हिन्दी or ಕನ್ನಡ on the Coach page or in Settings. The AI coach replies in that language and script (food names as people say them, numbers in digits), and the starter questions switch too. Demo answers stay in English and say so. New column `users.coach_language` (added automatically).
- The demo account now has a few days of water logged.

## 26 Nov 2026: fixes after the trust-and-speed release

- **Security: Pillow 13.0.0.** 12.3.0 had three published security issues, and Pillow processes every uploaded photo.
- **Package updates** (replacing Dependabot PRs #14 and #15): FastAPI 0.165, Uvicorn 0.54, SQLAlchemy 2.1, Pydantic 2.14, python-multipart 0.0.34, psycopg 3.3, PyJWT 2.15, pytest 9, Ruff 0.17; lucide-react 0.577, TypeScript 5.9. `pip-audit` and `npm audit` both report nothing.
- **Fixed: rate-limit counters were never forgotten.** Every email and IP address that tried to sign in stayed in the server's memory until it restarted. They are now cleared after a minute, as the privacy policy says.
- **Fixed: the API still went to sleep.** GitHub was running the keep-awake job only every few hours. The site now wakes the API as soon as it opens, and the deployment guide shows how to add a free 10-minute pinger.

## 26 Nov 2026: trust and speed

- **Privacy policy and terms** at `/privacy` and `/terms`, written for India's DPDP Act: what FitAI stores, which services process it (including Gemini for coach chats and meal photos), how long it's kept, and how to delete it. Linked from the landing page, sign-in pages and Settings.
- **Consent at sign-up.** Creating an account needs a ticked box (18+, Terms and Privacy Policy, use of health details). Accounts made before this see a one-time prompt and can accept or sign out. Stored as `consented_at` and `consent_version` on users (columns added automatically); changing `POLICY_VERSION` in `backend/app/legal.py` asks everyone again. New endpoint `POST /api/auth/consent`; `/auth/register` now needs `accept_terms: true`.
- **Error reports with Sentry (optional).** Off until `SENTRY_DSN` (Render) and `VITE_SENTRY_DSN` (Vercel) are set. Reports leave out request bodies, query strings, sign-in tokens, cookies, local variables and user details. In the browser, Sentry downloads only after the page has loaded.
- **Weekly encrypted database backups** (`.github/workflows/backup.yml`), kept 30 days. Off until the `DATABASE_URL` and `BACKUP_PASSPHRASE` repository secrets exist. Restore steps are in the deployment guide.
- **Upgrades:** React Router 7 and Vite 8 (with its new bundler). `npm audit` now reports 0 problems. CI runs on Node 22.
- **Frontend tests:** 18 Vitest and Testing Library tests (unit conversions, progression tips, calendar file, decimal typing, sign-up consent, the consent prompt, error-report scrubbing), run in CI before the build.
- **Faster first load.** The charts library (about 430 KB) no longer loads on the landing and sign-in pages, and on other pages the text appears first while charts fill in.
- **Smaller photos.** The 46 photos are WebP now, in 640, 960 and 1280 px copies; phones download the size they need. 6.8 MB of JPG became 4.0 MB at full size.

## 24 Nov 2026: v2 begins

- **Install FitAI like a phone app.** Add it to the home screen from Chrome (one-tap Install) or iPhone Safari (Share, then Add to Home Screen; the app shows the steps). It opens full screen with its own icon and shortcuts, and opens even without a connection. Only the app itself is cached, never personal data. A dismissible invite appears on phones; Settings has an *App and reminders* section.
- **Screen stays on during workouts,** so the phone doesn't lock between sets.
- **No more 40-second first load.** A free GitHub job (`.github/workflows/keep-awake.yml`) visits the API every 10 minutes so Render's free plan doesn't put it to sleep.
- **Barcode scanning.** In *Add food*, tap the barcode button and point the camera at a packet. It uses the phone's built-in reader where there is one and the open-source ZXing reader on iPhone (downloaded only when first used). The number is looked up in Open Food Facts, and the pack's own serving size is offered. Typing the number works too. New endpoint `GET /api/nutrition/barcode/{code}`.
- **Auto-progression.** When a workout starts, each exercise gets a target from the last time you logged it (double progression): hit the top of the rep range on every set and the weight goes up (2.5 kg; 5 kg for lower-body barbell and machine lifts; 2 kg for dumbbells), otherwise aim for one more rep, or stay at the weight until every set reaches the bottom of the range. Bodyweight moves add reps; planks add 5 seconds. Shown in kg or lb, and the target fills the boxes when you tick a set.
- **Same as yesterday, and saved meals.** An empty meal offers to copy what you ate for it the day before. Any logged meal can be saved ("My usual breakfast") and added again in one tap from the top of *Add food*. New table `saved_meals` (created automatically) and endpoints under `/api/nutrition/copy` and `/api/nutrition/saved-meals`.
- **Workout reminders in your phone's calendar.** Pick a time and alert, and FitAI creates a calendar file with your training days repeating weekly, plus a Sunday check-in. It works on iPhone, Android and computers with no server or push service; a Google Calendar link is offered too. In Settings and under your plan in Workouts.
- **Fixed:** two tests in `test_lifts.py` had the same name, so one never ran.
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
