from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models._mixins import TimestampMixin


class WaterLog(TimestampMixin, Base):
    """How much water someone drank on a day (one row per day, in ml)."""
    __tablename__ = "water_logs"
    __table_args__ = (UniqueConstraint("user_id", "logged_on", name="uq_water_user_day"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    logged_on: Mapped[date] = mapped_column(Date)
    ml: Mapped[int] = mapped_column(Integer, default=0)


class Break(TimestampMixin, Base):
    """A planned break: travel or a festival. During it calorie targets go to maintenance and the
    workout streak is paused (missed days don't count against it)."""
    __tablename__ = "breaks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # travel | festival
    start_on: Mapped[date] = mapped_column(Date)
    end_on: Mapped[date] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(String(80), nullable=True)  # e.g. "Diwali", "Goa trip"
