from datetime import date

from sqlalchemy import JSON, Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models._mixins import TimestampMixin


class WeeklyCheckin(TimestampMixin, Base):
    """One AI review per user per week (Monday-based). Regenerating in the same week replaces it."""
    __tablename__ = "weekly_checkins"
    __table_args__ = (UniqueConstraint("user_id", "week_start", name="uq_checkin_user_week"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    week_start: Mapped[date] = mapped_column(Date)
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    score: Mapped[int] = mapped_column(Integer)
    facts: Mapped[dict] = mapped_column(JSON)     # deterministic numbers, computed from stored data
    summary: Mapped[dict] = mapped_column(JSON)   # headline, wins[], focus[], next_week[]
    generated_by: Mapped[str] = mapped_column(String(100))
