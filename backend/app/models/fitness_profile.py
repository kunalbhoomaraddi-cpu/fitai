from sqlalchemy import JSON, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models._mixins import TimestampMixin


class FitnessProfile(TimestampMixin, Base):
    """All measurements are stored in metric (kg, cm). Units only affect display."""
    __tablename__ = "fitness_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    age: Mapped[int] = mapped_column(Integer)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)  # male | female | other | None
    height_cm: Mapped[float] = mapped_column(Float)
    current_weight_kg: Mapped[float] = mapped_column(Float)
    start_weight_kg: Mapped[float] = mapped_column(Float)
    target_weight_kg: Mapped[float] = mapped_column(Float)
    activity_level: Mapped[str] = mapped_column(String(20))  # sedentary|light|moderate|active|very_active
    experience: Mapped[str] = mapped_column(String(20))  # beginner|intermediate|advanced
    goal: Mapped[str] = mapped_column(String(30))  # weight_loss|muscle_gain|recomposition|general_fitness|maintenance
    diet_preference: Mapped[str] = mapped_column(String(30))  # vegetarian|vegan|eggetarian|non_vegetarian|custom
    custom_diet: Mapped[str | None] = mapped_column(String(200), nullable=True)
    food_restrictions: Mapped[list] = mapped_column(JSON, default=list)
    workout_days_per_week: Mapped[int] = mapped_column(Integer, default=3)
    workout_minutes: Mapped[int] = mapped_column(Integer, default=45)
    equipment: Mapped[list] = mapped_column(JSON, default=list)
    unit_system: Mapped[str] = mapped_column(String(10), default="metric")  # metric|imperial

    user = relationship("User", back_populates="profile")
