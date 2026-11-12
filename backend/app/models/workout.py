from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models._mixins import TimestampMixin


class WorkoutPlan(TimestampMixin, Base):
    __tablename__ = "workout_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    split: Mapped[str] = mapped_column(String(40))
    inputs: Mapped[dict] = mapped_column(JSON, default=dict)
    days: Mapped[list] = mapped_column(JSON)  # [{day, name, focus, exercises:[...]}]
    generated_by: Mapped[str] = mapped_column(String(100))
    coach_note: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    is_saved: Mapped[bool] = mapped_column(default=False)


class WorkoutSession(TimestampMixin, Base):
    """Workout history: a started/completed workout."""
    __tablename__ = "workout_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    plan_id: Mapped[int | None] = mapped_column(ForeignKey("workout_plans.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(160))
    started_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    exercises: Mapped[list] = mapped_column(JSON, default=list)  # with completed flags
    status: Mapped[str] = mapped_column(String(20), default="in_progress")  # in_progress|completed|abandoned
