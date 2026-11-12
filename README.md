# FitAI — Your Fitness. Your Goals. Your AI Coach.

FitAI is an AI-native personal fitness platform: a conversational coach that calls real backend tools, personalised meal and workout planning, nutrition and progress tracking, and motivation features, all in a premium dark interface.

> FitAI provides general fitness and wellness guidance. It is not a medical device and does not diagnose conditions.

## Quick start (macOS, MacBook Air M2)

```bash
# prerequisites (once):  brew install python@3.12 node
unzip FitAI.zip && cd FitAI
./start.sh
```

Then open **http://localhost:5173**. You can either:
- click **Explore the demo** to see a fully populated, clearly labelled sample account, or
- **Create an account** and go through onboarding.

The AI coach runs in a **labelled demo mode** until you add a free Gemini key to `backend/.env`:

```
GEMINI_API_KEY=your-key-from-https://aistudio.google.com/apikey
```

Restart with `./start.sh` after you add the key. See [LOCAL_SETUP.md](LOCAL_SETUP.md) for manual steps and troubleshooting.

## Features

| Module | What it does |
|---|---|
| **Landing page** | Public home page with hero, features, AI coach showcase, meal and workout highlights, how it works, FAQ and calls to action; responsive with scroll animations |
| **Authentication** | Registration with **email verification** and **two-step login** (6-digit email code on every login, via free Gmail SMTP), login, logout, bcrypt password hashing, JWT sessions persisted across reloads, protected routes, input validation, **forgot password** (emailed reset code; changing or resetting a password signs out every other device), rate-limited auth |
| **Onboarding & profile** | 6-step guided onboarding (metric or imperial), a live preview of BMR, TDEE, calorie target and macros, editable in Settings |
| **Dashboard** | Personalised hero with goal-progress ring, AI daily recommendation, stat cards, charts for weight, calories, protein and weekly activity, upcoming workout, daily quote, weekly challenges, achievements, quick actions |
| **AI Fitness Coach** | Chat with persistent conversations, Gemini function calling over **12 backend tools**, structured response cards (metrics, macros, weight trend, workout, foods, insights), Markdown, typing indicator, suggested prompts, save to dashboard |
| **AI Diet Planner** | Plans of 3, 4 or 5 meals matched to calories, macros, diet type, restrictions, budget and preferences. You can regenerate a meal, swap individual foods, save plans, view previous plans and mark meals as eaten (which logs them to the tracker). Every value is labelled *reference-calculated* or *AI-estimated* |
| **AI Workout Generator** | Push/Pull/Legs, Upper/Lower, Full Body, Beginner, Muscle Building, Fat Loss and Custom splits. Includes a weekly calendar, exercise illustrations, wger enrichment, a guided workout mode with set tracking, rest timer, duration tracking and history |
| **Calculator** | BMI, Mifflin-St Jeor BMR, TDEE (5 activity levels), a safe calorie target (deficit capped at 500 kcal, with calorie floors) and macros, all deterministic Python |
| **Nutrition Tracker** | Open Food Facts search with an offline reference database, custom foods, entries you can edit and delete, meal categories, progress rings, meal breakdown, 14-day history |
| **Progress Tracker** | Weight and body-measurement logging, target setting, weekly averages, a 4-week trend from linear regression, plateau detection, goal percentage, milestones and AI analysis grounded in stored data |
| **Progress Photos** | Private front, side and back photos by date, with a timeline, before/after comparison (side by side or a drag slider), days apart and weight change. Photos are resized and stripped of camera/GPS metadata on upload, stored in your database, only viewable by you when logged in, and never sent to the AI |
| **Weekly AI Check-in** | Once a week the coach reviews your last 7 days: workouts done vs planned, food-logging days, protein-target days and the weekly-average weight change. You get a 0–100 consistency score, wins, focus areas and measurable targets for next week, plus a warning if weight is dropping too fast. The numbers are calculated by the app and the AI only writes the wording (rules engine in demo mode). Includes a dashboard reminder and history |
| **Motivation** | 35 original daily quotes in 7 categories, 7 achievements, healthy streak logic, weekly challenges, confetti and notifications |
| **Settings** | Personal info, fitness and diet preferences, units, AI provider preference, password change, logout, account deletion |
| **Demo mode** | One-click sample account with 9 weeks of data, a rule-based coach that uses the *same tools* and is always labelled, and fallbacks for every external API |

## Technology

**Frontend:** React 18, TypeScript, Vite 5, Tailwind CSS 3, Recharts, Lucide, React Router 6, react-markdown, with self-hosted Inter and Manrope fonts.
**Backend:** Python 3.10+, FastAPI, Pydantic v2, SQLAlchemy 2, PyJWT and bcrypt, with httpx for outbound calls.
**Database:** SQLite locally. The code is portable to PostgreSQL (psycopg) without changes.
**AI:** Google Gemini REST API (default `gemini-3.8-flash`, fallback `gemini-3.5-flash-lite`, both configurable), Groq as an optional alternative, and a mock provider.
**External data:** Open Food Facts and the wger exercise API. Neither needs a key.
**Ops:** Dockerfiles, Docker Compose with an optional Postgres profile, nginx, a health check and pytest.

## Project structure

```
FitAI/
├── start.sh                    one-command local start
├── docker-compose.yml
├── backend/
│   ├── app/
│   │   ├── main.py  config.py  database.py
│   │   ├── models/      user, fitness_profile, weight, nutrition, workout, conversation, achievements
│   │   ├── schemas/     request/response validation
│   │   ├── routers/     auth, profile, dashboard, coach, diet, workouts, nutrition, progress, settings
│   │   ├── services/    auth, fitness (calculations), nutrition, workout, progress, demo
│   │   ├── ai/          provider abstraction, gemini, groq, mock, prompts, agent loop
│   │   ├── tools/       fitness/nutrition/workout/progress tools exposed to the LLM
│   │   ├── data/        reference foods, meal templates, exercise library, quotes
│   │   └── utils/       errors, HTTP cache + rate limiting
│   ├── tests/           41 pytest tests
│   ├── requirements.txt  .env.example  Dockerfile
├── frontend/
│   ├── src/  components/ pages/ layouts/ hooks/ services/ context/ types/ utils/
│   ├── public/images/art      original bundled artwork (57 SVGs)
│   ├── public/images/photos   Unsplash photos (downloaded by scripts/fetch_photos.sh)
│   ├── package.json  vite.config.ts  tailwind.config.js  Dockerfile  nginx.conf
├── scripts/            fetch_photos.sh, dev-backend.sh, dev-frontend.sh, test-all.sh, reset-db.sh
└── *.md                documentation
```

## Documentation

- [LOCAL_SETUP.md](LOCAL_SETUP.md): installation, running and troubleshooting
- [ENVIRONMENT_CONFIGURATION.md](ENVIRONMENT_CONFIGURATION.md): every variable, and where API keys go
- [PROJECT_ARCHITECTURE.md](PROJECT_ARCHITECTURE.md): architecture diagram, AI and tool calling, database design
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md): all endpoints (interactive docs at `http://localhost:8000/docs`)
- [TESTING_GUIDE.md](TESTING_GUIDE.md): what's tested and how to run it
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md): Docker, PostgreSQL and cloud deployment
- [IMAGE_CREDITS.md](IMAGE_CREDITS.md): image licensing
