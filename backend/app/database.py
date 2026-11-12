"""Database engine/session. Portable between SQLite (local) and PostgreSQL (production)."""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings

settings = get_settings()

_is_sqlite = settings.database_url.startswith("sqlite")
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    # Remote Postgres (e.g. Neon): keep a warm pool and avoid an extra "ping" round-trip on every
    # request; recycle connections before the provider closes idle ones (Neon scales to zero ~5 min).
    **({} if _is_sqlite else {"pool_size": 5, "max_overflow": 10, "pool_recycle": 240, "pool_pre_ping": False}),
)

if _is_sqlite:
    @event.listens_for(engine, "connect")
    def _sqlite_fk(dbapi_conn, _):  # enforce foreign keys in SQLite
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Schema initialization strategy: create all tables idempotently.
    For production schema evolution, see DEPLOYMENT_GUIDE.md (Alembic)."""
    from app import models  # noqa: F401  (register models)

    Base.metadata.create_all(bind=engine)
    run_light_migrations()


def run_light_migrations() -> None:
    """Adds columns introduced after a database was first created (create_all never alters
    existing tables). Safe to run on every start, on SQLite and PostgreSQL."""
    from sqlalchemy import inspect, text

    insp = inspect(engine)
    if "users" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("users")}
        if "email_verified" not in cols:
            with engine.begin() as conn:
                # accounts created before email verification existed are treated as verified
                conn.execute(text("ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT TRUE"))
    # PostgreSQL enforces VARCHAR lengths (SQLite doesn't): widen columns that grew in later versions
    if engine.dialect.name == "postgresql":
        widen = {("workout_plans", "generated_by"): 100, ("diet_plans", "generated_by"): 100,
                 ("messages", "provider"): 100, ("saved_recommendations", "source"): 100}
        with engine.begin() as conn:
            for (table, col), size in widen.items():
                cur = conn.execute(text("SELECT character_maximum_length FROM information_schema.columns "
                                        "WHERE table_name = :t AND column_name = :c"), {"t": table, "c": col}).scalar()
                if cur is not None and cur < size:
                    conn.execute(text(f"ALTER TABLE {table} ALTER COLUMN {col} TYPE VARCHAR({size})"))
