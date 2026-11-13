"""FitAI API entrypoint.  Run locally:  uvicorn app.main:app --reload"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.ai.provider import available_providers
from app.config import get_settings
from app.database import init_db
from app.routers import auth, checkins, coach, dashboard, diet, nutrition, photos, profile, progress, workouts
from app.routers import settings as settings_router
from app.utils.clock import TimezoneMiddleware
from app.utils.errors import register_exception_handlers

settings = get_settings()
logging.basicConfig(level=settings.log_level, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("fitai")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.environment == "production":
        problems = settings.production_problems()
        if problems:
            for p in problems:
                log.error("Production setting problem: %s", p)
            raise RuntimeError("FitAI refused to start: fix the settings listed above. " + " | ".join(problems))
    init_db()
    try:
        from app.database import SessionLocal
        from app.services.demo_service import purge_expired_demos
        with SessionLocal() as db:
            n = purge_expired_demos(db)
            if n:
                log.info("Removed %d expired demo account(s)", n)
    except Exception:  # never block start-up on housekeeping
        log.exception("Demo clean-up failed")
    prov = available_providers()
    log.info("FitAI API ready · db=%s · gemini=%s groq=%s · external_apis=%s",
             settings.database_url.split("://")[0], prov["gemini"], prov["groq"], settings.enable_external_apis)
    yield


app = FastAPI(title="FitAI API", version="1.0.0", lifespan=lifespan,
              description="AI-native personal fitness platform. Interactive docs at /docs.")
app.add_middleware(TimezoneMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True,
                   allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                   allow_headers=["Authorization", "Content-Type", "X-Timezone"])
register_exception_handlers(app)

API = "/api"
for r in (auth, profile, dashboard, coach, diet, workouts, nutrition, progress, checkins, photos, settings_router):
    app.include_router(r.router, prefix=API)


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok", "app": settings.app_name, "environment": settings.environment,
            "ai": available_providers()}


# Optional: serve the built frontend (single-container deployments). Skipped if not built.
_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _dist.exists():
    from fastapi.staticfiles import StaticFiles

    app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            from fastapi import HTTPException
            raise HTTPException(404, "Not found")
        f = _dist / path
        if path and f.is_file() and _dist in f.resolve().parents:
            return FileResponse(f)
        return FileResponse(_dist / "index.html")
