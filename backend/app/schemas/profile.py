from typing import Literal

from pydantic import BaseModel, Field

Goal = Literal["weight_loss", "muscle_gain", "recomposition", "general_fitness", "maintenance"]
Activity = Literal["sedentary", "light", "moderate", "active", "very_active"]
Diet = Literal["vegetarian", "vegan", "eggetarian", "non_vegetarian", "custom"]
Experience = Literal["beginner", "intermediate", "advanced"]


class ProfileIn(BaseModel):
    """All body values in metric (kg / cm). The frontend converts imperial input before sending."""
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    age: int = Field(ge=13, le=100)
    gender: Literal["male", "female", "other"] | None = None
    height_cm: float = Field(gt=100, lt=250)
    current_weight_kg: float = Field(gt=30, lt=300)
    target_weight_kg: float = Field(gt=30, lt=300)
    activity_level: Activity
    experience: Experience
    goal: Goal
    diet_preference: Diet
    custom_diet: str | None = Field(default=None, max_length=200)
    food_restrictions: list[str] = Field(default_factory=list, max_length=20)
    workout_days_per_week: int = Field(ge=1, le=7, default=3)
    workout_minutes: int = Field(ge=15, le=180, default=45)
    equipment: list[str] = Field(default_factory=list, max_length=20)
    unit_system: Literal["metric", "imperial"] = "metric"


class ProfileOut(ProfileIn):
    start_weight_kg: float
    model_config = {"from_attributes": True}


class CalcIn(BaseModel):
    weight_kg: float = Field(gt=30, lt=300)
    height_cm: float = Field(gt=100, lt=250)
    age: int = Field(ge=13, le=100)
    gender: Literal["male", "female", "other"] | None = None
    activity_level: Activity
    goal: Goal
