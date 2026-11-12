from datetime import date

from sqlalchemy import JSON, Date, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models._mixins import TimestampMixin


class FoodEntry(TimestampMixin, Base):
    """Daily nutrition records are derived by aggregating food entries per (user, date)."""
    __tablename__ = "food_entries"
    __table_args__ = (Index("ix_food_user_date", "user_id", "eaten_on"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    eaten_on: Mapped[date] = mapped_column(Date)
    meal: Mapped[str] = mapped_column(String(20))  # breakfast|lunch|snack|dinner
    name: Mapped[str] = mapped_column(String(200))
    quantity_g: Mapped[float] = mapped_column(Float)
    calories: Mapped[float] = mapped_column(Float)
    protein_g: Mapped[float] = mapped_column(Float)
    carbs_g: Mapped[float] = mapped_column(Float)
    fat_g: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(30), default="custom")  # open_food_facts|reference|custom|meal_plan
    source_id: Mapped[str | None] = mapped_column(String(64), nullable=True)


class DietPlan(TimestampMixin, Base):
    __tablename__ = "diet_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    plan_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    targets: Mapped[dict] = mapped_column(JSON)
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)
    meals: Mapped[list] = mapped_column(JSON)  # list of meal dicts (see schemas.plans.Meal)
    generated_by: Mapped[str] = mapped_column(String(100))  # llm:<provider> | reference_engine
    coach_note: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    is_saved: Mapped[bool] = mapped_column(default=False)
