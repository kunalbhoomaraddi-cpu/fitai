from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models._mixins import TimestampMixin


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Existing rows are treated as verified by the startup migration (see database.run_light_migrations)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # sessions issued before this moment are rejected (set on password change/reset)
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)  # IANA name from the browser, e.g. Asia/Kolkata
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # per-user AI preference: auto | gemini | groq | mock (keys always stay server-side)
    ai_provider_pref: Mapped[str] = mapped_column(String(20), default="auto", nullable=False)

    profile = relationship("FitnessProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
